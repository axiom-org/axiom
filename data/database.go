package data

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os/user"
	"strings"
	"sync"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"

	"github.com/axiom-org/axiom/util"
)

// A Database encapsulates a connection to a Postgres database.
// It is threadsafe.
type Database struct {
	name     string
	postgres *sqlx.DB

	// reads generally cannot be used in a threadsafe way. Just use it for testing
	reads int

	// The mutex guards the transaction in progress and the member
	// variables below this line.
	// All writes happen via this transaction.
	mutex sync.Mutex

	// tx is nil when there is no transaction in progress
	tx *sqlx.Tx

	// To be threadsafe, don't access these directly. Use CurrentSlot() instead.
	// currentSlot is the last slot that has been finalized to the database.
	currentSlot int

	// How many commits have happened in the lifetime of this db handle
	commits int

	config *Config
}

var allDatabases = []*Database{}

func boundLimit(limit int) int {
	if limit <= 0 {
		return 100
	}
	if limit > 500 {
		return 500
	}
	return limit
}

func NewDatabase(config *Config) *Database {
	user, err := user.Current()
	check(err)
	username := strings.Replace(config.User, "$USER", user.Username, 1)
	info := fmt.Sprintf(
		"host=%s port=%d user=%s dbname=%s sslmode=disable statement_timeout=%d",
		config.Host, config.Port, username, config.Database, 5000)
	// util.Logger.Printf("connecting to postgres with %s", info)
	if len(config.Password) > 0 {
		util.Logger.Printf("(password hidden)")
		info = fmt.Sprintf("%s password=%s", info, config.Password)
	}
	postgres, err := sqlx.Connect("postgres", info)
	retries := 3
	for i := 0; i < retries && err != nil; i++ {
		util.Logger.Printf("postgres connection failure. retrying...")
		time.Sleep(2000 * time.Millisecond)
		postgres, err = sqlx.Connect("postgres", info)
	}
	if err != nil {
		util.Logger.Printf("failed to connect to postgres with user %s, db %s",
			username, config.Database)
		panic(err)
	}
	util.Logger.Printf("postgres connection successful")

	if config.testOnly {
		// util.Logger.Printf("clearing test-only database %s", config.Database)
		postgres.Exec("DELETE FROM blocks")
		postgres.Exec("DELETE FROM accounts")
		postgres.Exec("DELETE FROM documents")
		postgres.Exec("DELETE FROM buckets")
		postgres.Exec("DELETE FROM providers")
		postgres.Exec("DELETE FROM allocations")
	}

	db := &Database{
		postgres: postgres,
		name:     config.Database,
		config:   config,
	}
	db.initialize()
	allDatabases = append(allDatabases, db)
	return db
}

// Creates a new database handle designed to be used for unit tests.
// Whenever this is created, any existing data in the database is deleted.
func NewTestDatabase(i int) *Database {
	return NewDatabase(NewTestConfig(i))
}

func (db *Database) Config() *Config {
	return db.config
}

const schema = `
CREATE TABLE IF NOT EXISTS blocks (
    slot integer,
    chunk json NOT NULL,
    c integer,
    h integer,
    d json NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS block_slot_idx ON blocks (slot);

CREATE TABLE IF NOT EXISTS accounts (
    owner text,
    sequence integer CHECK (sequence >= 0),
    balance bigint CHECK (balance >= 0),
    storage integer CHECK (storage >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS account_owner_idx ON accounts (owner);

CREATE TABLE IF NOT EXISTS documents (
    id bigint,
    data jsonb NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS document_id_idx ON documents (id);
CREATE INDEX IF NOT EXISTS document_data_idx ON documents USING gin (data jsonb_path_ops);

CREATE TABLE IF NOT EXISTS buckets (
    name text,
    owner text,
    size integer,
    providers bigint[],
    magnet text
);

CREATE UNIQUE INDEX IF NOT EXISTS bucket_name_idx ON buckets (name);
CREATE INDEX IF NOT EXISTS bucket_owner_idx ON buckets (owner);
CREATE INDEX IF NOT EXISTS bucket_provider_idx ON buckets (providers);

CREATE TABLE IF NOT EXISTS providers (
    id bigint,
    owner text,
    capacity integer,
    available integer,
    buckets text[]
);

CREATE UNIQUE INDEX IF NOT EXISTS provider_id_idx ON providers (id);
CREATE INDEX IF NOT EXISTS provider_owner_idx ON providers (owner);
CREATE INDEX IF NOT EXISTS provider_bucket_idx ON providers (buckets);
`

// Not threadsafe, caller should hold mutex or be in init
func (db *Database) updateCurrentSlot() {
	b := db.LastBlock()
	if b == nil {
		db.currentSlot = 0
	} else {
		db.currentSlot = b.Slot
	}
}

// initialize makes sure the schemas are set up right and panics if not
func (db *Database) initialize() {
	// There are some strange errors on initialization that I don't understand.
	// Just sleep a bit and retry.
	errors := 0
	for {
		_, err := db.postgres.Exec(schema)
		if err == nil {
			if errors > 0 {
				util.Logger.Printf("db init retry successful")
			}
			db.updateCurrentSlot()
			return
		}
		util.Logger.Printf("db init error: %s", err)
		errors += 1
		if errors >= 3 {
			panic("too many db errors")
		}
		time.Sleep(time.Millisecond * time.Duration(200*errors))
	}
	panic("control should not reach here")
}

// namedExecTx is a helper function to execute a write within the pending transaction.
func (db *Database) namedExecTx(query string, arg interface{}) (sql.Result, error) {
	db.mutex.Lock()
	defer db.mutex.Unlock()
	if db.tx == nil {
		db.tx = db.postgres.MustBegin()
	}

	res, err := db.tx.NamedExec(query, arg)
	return res, err
}

// execTx is a helper function to execute a write within the pending transaction.
func (db *Database) execTx(query string, args ...interface{}) (sql.Result, error) {
	db.mutex.Lock()
	defer db.mutex.Unlock()
	if db.tx == nil {
		db.tx = db.postgres.MustBegin()
	}

	res, err := db.tx.Exec(query, args...)
	return res, err
}

// getTx is a helper function to execute a Get within the pending transaction.
func (db *Database) getTx(dest interface{}, query string, args ...interface{}) error {
	db.mutex.Lock()
	defer db.mutex.Unlock()
	if db.tx == nil {
		db.tx = db.postgres.MustBegin()
	}

	return db.tx.Get(dest, query, args...)
}

func (db *Database) CurrentSlot() int {
	db.mutex.Lock()
	defer db.mutex.Unlock()
	return db.currentSlot
}

func (db *Database) Commits() int {
	db.mutex.Lock()
	defer db.mutex.Unlock()
	return db.commits
}

func (db *Database) TransactionInProgress() bool {
	db.mutex.Lock()
	defer db.mutex.Unlock()

	return db.tx != nil
}

// Commit commits the pending transaction. If there is any error, it panics.
func (db *Database) Commit() {
	db.mutex.Lock()
	defer db.mutex.Unlock()

	if db.tx == nil {
		return
	}
	check(db.tx.Commit())
	db.tx = nil
	db.commits++
	db.updateCurrentSlot()
}

func (db *Database) Rollback() {
	db.mutex.Lock()
	defer db.mutex.Unlock()

	if db.tx == nil {
		return
	}
	check(db.tx.Rollback())
	db.tx = nil
}

// Panics if a transaction was left open
func (db *Database) AssertDone() {
	db.mutex.Lock()
	defer db.mutex.Unlock()

	if db.tx != nil {
		panic("a transaction was left in progress")
	}
}

// Can be used for testing so that we can find who left open a transaction.
// If you suspect a test of leaving an uncommitted transaction, call this at the
// end of it.
func CheckAllDatabasesCommitted() {
	for _, db := range allDatabases {
		if db.TransactionInProgress() {
			util.Logger.Fatalf("a transaction was left open in db %s", db.name)
		}
	}
	allDatabases = []*Database{}
}

func (db *Database) TotalSizeInfo() string {
	var answer string
	err := db.postgres.Get(
		&answer,
		"SELECT pg_size_pretty(pg_database_size($1))",
		db.name)
	if err != nil {
		return err.Error()
	}
	return answer
}

// Ideally returns (nil, error) if the query message is invalid.
// There might be some code paths that return nil, nil when it's invalid.
func (db *Database) HandleQueryMessage(m *QueryMessage) (*DataMessage, error) {
	if m == nil {
		return nil, fmt.Errorf("nil is not a valid query message")
	}

	if m.Account != "" {
		return db.AccountDataMessage(m.Account), nil
	}

	if m.Block != 0 {
		return db.BlockDataMessage(m.Block), nil
	}

	if m.Documents != nil {
		return db.DocumentDataMessage(m.Documents), nil
	}

	if m.Signature != "" {
		return db.SignatureDataMessage(m.Signature), nil
	}

	if m.Buckets != nil {
		return db.BucketDataMessage(m.Buckets), nil
	}

	if m.Providers != nil {
		return db.ProviderDataMessage(m.Providers), nil
	}

	return nil, fmt.Errorf("query message does not contain any recognizable fields")
}

// readTransaction is a helper to let you use a transaction to fetch data that reflects
// the state of the blockchain at a known slot.
// It returns a transaction you can use for reads and the slot that this transaction
// reflects.
// Be sure to call finishReadTransaction(tx) when you are done with it.
func (db *Database) readTransaction() (*sqlx.Tx, int) {
	// We need "repeatable read" isolation level so that those queries reflect
	// the same snapshot of the db. See:
	// https://www.postgresql.org/docs/9.1/static/transaction-iso.html
	tx := db.postgres.MustBeginTx(context.Background(), &sql.TxOptions{
		Isolation: sql.LevelRepeatableRead,
		ReadOnly:  true,
	})

	block := &Block{}
	var slot int
	err := tx.Get(block, "SELECT * FROM blocks ORDER BY slot DESC LIMIT 1")
	if err == sql.ErrNoRows {
		slot = 0
	} else {
		check(err)
		slot = block.Slot
	}

	return tx, slot
}

func (db *Database) finishReadTransaction(tx *sqlx.Tx) {
	check(tx.Rollback())
	db.reads++
}

func (db *Database) AccountDataMessage(owner string) *DataMessage {
	tx, slot := db.readTransaction()

	account := &Account{}
	err := tx.Get(account, "SELECT * FROM accounts WHERE owner=$1", owner)
	if err == sql.ErrNoRows {
		account = nil
	} else {
		check(err)
	}

	db.finishReadTransaction(tx)

	return &DataMessage{
		I:        slot,
		Accounts: map[string]*Account{owner: account},
	}
}

func (db *Database) BlockDataMessage(slot int) *DataMessage {
	block := db.GetBlock(slot)
	return &DataMessage{
		Blocks: map[int]*Block{slot: block},
	}
}

func (db *Database) DocumentDataMessage(q *DocumentQuery) *DataMessage {
	docs, slot := db.GetDocuments(q.Data.content, q.Limit)
	message := &DataMessage{
		Documents: docs,
		I:         slot,
	}
	return message
}

func (db *Database) BucketDataMessage(q *BucketQuery) *DataMessage {
	buckets, slot := db.GetBuckets(q)
	if buckets == nil {
		return nil
	}
	message := &DataMessage{
		Buckets: buckets,
		I:       slot,
	}
	return message
}

func (db *Database) ProviderDataMessage(q *ProviderQuery) *DataMessage {
	providers, slot := db.GetProviders(q)
	if providers == nil {
		return nil
	}
	message := &DataMessage{
		Providers: providers,
		I:         slot,
	}
	return message
}

// Currently just checks the last 20 blocks for the right operation.
// TODO: store ops by signature somewhere
func (db *Database) SignatureDataMessage(signature string) *DataMessage {
	blocks := db.TailBlocks(20)
	answer := &DataMessage{
		Operations: map[string]*SignedOperation{},
	}
	for _, block := range blocks {
		if block.Slot > answer.I {
			answer.I = block.Slot
		}
		op := block.GetOperation(signature)
		if op != nil {
			answer.Operations[signature] = op
		}
	}
	return answer
}

// CheckBlockReplay replays the blockchain from the beginning
// and returns an error if the result conflicts with the data held in our database.
func (db *Database) CheckBlockReplay() error {
	cache := NewCache()
	for _, account := range Airdrop {
		cache.UpsertAccount(account)
	}
	var err error
	db.ForBlocks(func(b *Block) {
		if err == nil {
			err = cache.ProcessChunk(b.Chunk)
		}
	})
	if err != nil {
		return err
	}
	return cache.CheckAgainstDatabase(db)
}

func isUniquenessError(e error) bool {
	if e == nil {
		return false
	}
	return strings.Contains(e.Error(), "duplicate key value violates unique constraint")
}

func isNoRowsError(e error) bool {
	if e == nil {
		return false
	}
	return strings.Contains(e.Error(), "no rows in result set")
}

//////////////
// Blocks
//////////////

const blockInsert = `
INSERT INTO blocks (slot, chunk, c, h, d)
VALUES (:slot, :chunk, :c, :h, :d)
`

// InsertBlock returns an error if it failed because this block is already saved.
// It panics if there is a fundamental database problem.
// It returns an error if this block is not unique.
// If this returns an error, the pending transaction will be unusable.
func (db *Database) InsertBlock(b *Block) error {
	if b == nil {
		util.Logger.Fatal("cannot insert nil block")
	}
	cur := db.CurrentSlot()
	if b.Slot != cur+1 {
		util.Logger.Fatalf("inserting block at slot %d but db has slot %d", b.Slot, cur)
	}
	_, err := db.namedExecTx(blockInsert, b)
	if isUniquenessError(err) {
		return err
	}
	check(err)
	return nil
}

// GetBlock returns nil if there is no block for the provided slot.
func (db *Database) GetBlock(slot int) *Block {
	answer := &Block{}
	err := db.postgres.Get(answer, "SELECT * FROM blocks WHERE slot=$1", slot)
	db.reads++
	if err == sql.ErrNoRows {
		return nil
	}
	check(err)
	return answer
}

// LastBlock returns nil if the database has no blocks in it yet.
func (db *Database) LastBlock() *Block {
	answer := &Block{}
	err := db.postgres.Get(answer, "SELECT * FROM blocks ORDER BY slot DESC LIMIT 1")
	db.reads++
	if err == sql.ErrNoRows {
		return nil
	}
	check(err)
	return answer
}

// TailBlocks returns the last n blocks, or all blocks if there are less than n.
// They are in reverse chronological order.
func (db *Database) TailBlocks(n int) []*Block {
	rows, err := db.postgres.Queryx("SELECT * FROM blocks ORDER BY slot DESC LIMIT $1", n)
	db.reads++
	check(err)
	answer := []*Block{}
	for rows.Next() {
		b := &Block{}
		check(rows.StructScan(b))
		answer = append(answer, b)
	}
	return answer
}

// ForBlocks calls f on each block in the db, from lowest to highest number.
// It returns the number of blocks that were processed.
func (db *Database) ForBlocks(f func(b *Block)) int {
	slot := 0
	rows, err := db.postgres.Queryx("SELECT * FROM blocks ORDER BY slot")
	db.reads++
	check(err)
	for rows.Next() {
		b := &Block{}
		check(rows.StructScan(b))
		if b.Slot != slot+1 {
			util.Logger.Fatalf(
				"a block with slot %d exists, but no block has slot %d", b.Slot, slot+1)
		}
		slot += 1
		f(b)
	}
	return slot
}

//////////////
// Accounts
//////////////

const accountUpsert = `
INSERT INTO accounts (owner, sequence, balance, storage)
VALUES (:owner, :sequence, :balance, :storage)
ON CONFLICT (owner) DO UPDATE
  SET sequence = EXCLUDED.sequence,
      balance = EXCLUDED.balance,
      storage = EXCLUDED.storage;
`

// Database.UpsertAccount will not finalize until Commit is called.
func (db *Database) UpsertAccount(a *Account) error {
	_, err := db.namedExecTx(accountUpsert, a)
	check(err)
	return nil
}

// GetAccount returns nil if there is no account for the given owner.
func (db *Database) GetAccount(owner string) *Account {
	answer := &Account{}
	err := db.postgres.Get(answer, "SELECT * FROM accounts WHERE owner=$1", owner)
	db.reads++
	if err == sql.ErrNoRows {
		return nil
	}
	check(err)
	return answer
}

type DatabaseAccountIterator struct {
	rows *sqlx.Rows
}

func (iter *DatabaseAccountIterator) Next() *Account {
	if !iter.rows.Next() {
		return nil
	}
	a := &Account{}
	check(iter.rows.StructScan(a))
	return a
}

func (db *Database) IterAccounts() AccountIterator {
	rows, err := db.postgres.Queryx("SELECT * FROM accounts ORDER BY owner")
	db.reads++
	check(err)
	return &DatabaseAccountIterator{
		rows: rows,
	}
}

// ForAccounts calls f on each account in the db, in no particular order.
// It returns the number of accounts.
func (db *Database) ForAccounts(f func(a *Account)) int {
	count := 0
	iter := db.IterAccounts()
	for {
		a := iter.Next()
		if a == nil {
			return count
		}
		count += 1
		f(a)
	}
}

// MaxBalance is slow, so we just use it for testing
func (db *Database) MaxBalance() uint64 {
	max := uint64(0)
	db.ForAccounts(func(a *Account) {
		if a.Balance > max {
			max = a.Balance
		}
	})
	return max
}

//////////////
// Documents
//////////////

const documentInsert = `
INSERT INTO documents (id, data)
VALUES (:id, :data)
`

// InsertDocument returns an error if it failed because there is already a document with
// this id.
// It uses the transaction.
// It panics if there is a fundamental database problem.
// If this returns an error, the pending transaction will be unusable.
func (db *Database) InsertDocument(d *Document) error {
	_, err := db.namedExecTx(documentInsert, d)
	if isUniquenessError(err) {
		return err
	}
	check(err)
	return nil
}

func (db *Database) GetDocument(id uint64) *Document {
	rows, err := db.postgres.Queryx(
		"SELECT * FROM documents WHERE id = $1 LIMIT 1", id)
	check(err)
	for rows.Next() {
		d := &Document{}
		check(rows.StructScan(d))
		return d
	}
	return nil
}

const documentUpdate = `
UPDATE documents
SET data = :data
WHERE id = :id
`

const documentDelete = `
DELETE FROM documents
WHERE id = $1
`

// SetDocument changes the contents of the document to be precisely the provided data.
// It uses the transaction.
// This panics if there is a fundamental database error.
// This returns an error if there is no such document, and the pending
// transaction will still be usable.
// If there is no such document, no change is made.
func (db *Database) SetDocument(doc *Document) error {
	res, err := db.namedExecTx(documentUpdate, doc)
	check(err)
	count, err := res.RowsAffected()
	check(err)
	if count != 1 {
		return fmt.Errorf("expected 1 document row affected, got %d", count)
	}
	return nil
}

// UpdateDocument updates the contents of the document, using the transaction.
// Errors when there is no such document.
// If this returns an error, the pending transaction will be unusable.
func (db *Database) UpdateDocument(id uint64, data *JSONObject) error {
	// It needs to do a read within the transaction
	doc := &Document{}
	err := db.getTx(doc, "SELECT * FROM documents WHERE id = $1 LIMIT 1", id)
	if err != nil {
		return err
	}
	doc.Data.UpdateWith(data)
	db.SetDocument(doc)
	return nil
}

// DeleteDocument deletes the document, using the transaction.
// It errors when there is no such document.
// If this returns an error, the pending transaction will still be usable.
func (db *Database) DeleteDocument(id uint64) error {
	res, err := db.execTx(documentDelete, id)
	check(err)
	count, err := res.RowsAffected()
	check(err)
	if count != 1 {
		return fmt.Errorf("expected 1 document deleted, got %d", count)
	}
	return nil
}

// GetDocuments returns a list of matching documents, along with the slot that this
// data reflects.
func (db *Database) GetDocuments(match map[string]interface{}, limit int) ([]*Document, int) {
	limit = boundLimit(limit)

	bytes, err := json.Marshal(match)
	check(err)

	tx, slot := db.readTransaction()

	rows, err := tx.Queryx(
		"SELECT * FROM documents WHERE data @> $1 LIMIT $2", string(bytes), limit)
	check(err)
	answer := []*Document{}
	for rows.Next() {
		d := &Document{}
		check(rows.StructScan(d))
		answer = append(answer, d)
	}

	db.finishReadTransaction(tx)

	return answer, slot
}

//////////////
// Buckets
//////////////

const bucketInsert = `
INSERT INTO buckets (name, owner, size, magnet)
VALUES (:name, :owner, :size, :magnet)
`

const bucketUpdate = `
UPDATE buckets
SET magnet = :magnet
WHERE name = :name
`

const bucketDelete = `
DELETE FROM buckets
WHERE name = $1 AND coalesce(array_length(providers, 1), 0) = 0
`

// InsertBucket returns an error if it failed because there is already a bucket with
// this name.
// It uses the transaction.
// It panics if there is a fundamental database problem.
func (db *Database) InsertBucket(b *Bucket) error {
	if !b.IsValidNewBucket() {
		return fmt.Errorf("invalid new bucket: %+v", b)
	}
	_, err := db.namedExecTx(bucketInsert, b)
	if isUniquenessError(err) {
		return err
	}
	check(err)
	return nil
}

func (db *Database) UpdateBucket(b *Bucket) error {
	if !IsValidMagnet(b.Magnet) {
		panic(fmt.Sprintf("bad bucket in UpdateBucket: %+v", b))
	}
	res, err := db.namedExecTx(bucketUpdate, b)
	check(err)
	count, err := res.RowsAffected()
	check(err)
	if count != 1 {
		return fmt.Errorf("expected 1 bucket row affected, got %d", count)
	}
	return nil
}

// A helper to get a bucket within the current transaction.
// Returns nil if there is none. Panics if there is a fundamental db error.
func (db *Database) getBucketTx(bucketName string) *Bucket {
	bucket := &Bucket{}
	err := db.getTx(bucket, "SELECT * FROM buckets WHERE name = $1 LIMIT 1", bucketName)
	if isNoRowsError(err) {
		return nil
	}
	check(err)
	return bucket
}

// Returns nil if there is no such bucket
func (db *Database) GetBucket(name string) *Bucket {
	q := &BucketQuery{
		Name:  name,
		Limit: 1,
	}
	buckets, _ := db.GetBuckets(q)
	if len(buckets) == 0 {
		return nil
	}
	return buckets[0]
}

// DeleteBucket deletes the bucket, using the transaction.
// Providers must be cleared before a bucket can be deleted.
// It errors when there is no such bucket, or if providers have not been cleared.
func (db *Database) DeleteBucket(name string) error {
	res, err := db.execTx(bucketDelete, name)
	check(err)
	count, err := res.RowsAffected()
	check(err)
	if count != 1 {
		return fmt.Errorf("expected 1 bucket deleted, got %d", count)
	}
	return nil
}

// GetBuckets returns a list of matching buckets, along with the slot
// that this data reflects.
// If the query is invalid, returns nil.
// This does not inflate the provider data.
func (db *Database) GetBuckets(q *BucketQuery) ([]*Bucket, int) {
	limit := boundLimit(q.Limit)
	tx, slot := db.readTransaction()

	whereParts := []string{}
	if q.Name != "" {
		whereParts = append(whereParts, "name = :name")
	}
	if q.Owner != "" {
		whereParts = append(whereParts, "owner = :owner")
	}
	if q.Provider != 0 {
		whereParts = append(whereParts, ":provider = ANY (providers)")
	}
	if len(q.Names) != 0 {
		whereParts = append(whereParts,
			fmt.Sprintf("name IN (%s)", joinBucketNamesForSQL(q.Names)))
	}
	if len(whereParts) == 0 {
		return nil, 0
	}
	where := strings.Join(whereParts, " AND ")

	query := fmt.Sprintf("SELECT * FROM buckets WHERE %s LIMIT %d", where, limit)
	rows, err := tx.NamedQuery(query, q)
	if err != nil {
		util.Logger.Fatalf("failed on query %s with error %s", query, err)
	}

	buckets := []*Bucket{}
	for rows.Next() {
		b := &Bucket{}
		check(rows.StructScan(b))
		buckets = append(buckets, b)
	}

	db.finishReadTransaction(tx)
	return buckets, slot
}

////////////////
// Providers
////////////////

const providerInsert = `
INSERT INTO providers (id, owner, capacity, available)
VALUES (:id, :owner, :capacity, :available)
`

const providerUpdate = `
UPDATE providers
SET capacity = :capacity, available = :available
WHERE id = :id
`

const providerDelete = `
DELETE FROM providers
WHERE id = $1 AND coalesce(array_length(buckets, 1), 0) = 0
`

// InsertProvider returns an error if it failed because there is already a provider with
// this id.
// It uses the transaction.
// It panics if there is a fundamental database problem.
// If this returns an error, the pending transaction will be unusable.
func (db *Database) InsertProvider(p *Provider) error {
	if !p.IsValidNewProvider() {
		util.Logger.Fatalf("invalid provider to insert: %+v", p)
	}

	_, err := db.namedExecTx(providerInsert, p)
	if isUniquenessError(err) {
		return err
	}
	check(err)
	return nil
}

// A helper to get a provider within the current transaction.
// Returns nil if there is none. Panics if there is a fundamental db error.
func (db *Database) getProviderTx(providerID uint64) *Provider {
	p := &Provider{}
	err := db.getTx(p, "SELECT * FROM providers WHERE id = $1 LIMIT 1", providerID)
	if isNoRowsError(err) {
		return nil
	}
	check(err)
	return p
}

// Returns nil if there is no such provider
func (db *Database) GetProvider(id uint64) *Provider {
	q := &ProviderQuery{
		ID:    id,
		Limit: 1,
	}
	providers, _ := db.GetProviders(q)
	if len(providers) == 0 {
		return nil
	}
	return providers[0]
}

// GetProviders returns a list of matching providers, along with the slot that this
// data reflects.
// If the query is invalid, returns nil.
// This does not inflate the bucket data.
func (db *Database) GetProviders(q *ProviderQuery) ([]*Provider, int) {
	limit := boundLimit(q.Limit)

	whereParts := []string{}
	if q.ID != 0 {
		whereParts = append(whereParts, "id = :id")
	}
	if q.Owner != "" {
		whereParts = append(whereParts, "owner = :owner")
	}
	if len(q.IDs) != 0 {
		whereParts = append(whereParts, fmt.Sprintf("id IN (%s)", joinUint64s(q.IDs)))
	}
	if q.Available != 0 {
		whereParts = append(whereParts, "available >= :available")
	}
	if q.Bucket != "" {
		whereParts = append(whereParts, ":bucket = ANY (buckets)")
	}
	if len(whereParts) == 0 {
		return nil, 0
	}
	where := strings.Join(whereParts, " AND ")

	tx, slot := db.readTransaction()
	query := fmt.Sprintf("SELECT * FROM providers WHERE %s LIMIT %d", where, limit)
	rows, err := tx.NamedQuery(query, q)
	if err != nil {
		util.Logger.Fatalf("failed on query %s with error %s", query, err)
	}

	answer := []*Provider{}
	for rows.Next() {
		p := &Provider{}
		check(rows.StructScan(p))
		answer = append(answer, p)
	}

	db.finishReadTransaction(tx)

	return answer, slot
}

// Increases the capacity of a provider.
// If there is no such provider, returns an error.
func (db *Database) AddCapacity(id uint64, amount uint32) error {
	p := db.getProviderTx(id)
	p.Capacity += amount
	p.Available += amount
	res, err := db.namedExecTx(providerUpdate, p)
	check(err)
	count, err := res.RowsAffected()
	check(err)
	if count != 1 {
		return fmt.Errorf("expected 1 provider row affected, got %d", count)
	}
	return nil
}

// DeleteProvider deletes the provider, using the transaction.
// Buckets must all be deallocated before a provider can be deleted.
// It returns an error when there is no such provider or when buckets were still allocated.
func (db *Database) DeleteProvider(id uint64) error {
	// First delete the provider
	res, err := db.execTx(providerDelete, id)
	check(err)
	count, err := res.RowsAffected()
	check(err)
	if count != 1 {
		return fmt.Errorf("expected 1 provider deleted, got %d", count)
	}
	return nil
}

/////////////////
// Allocation
/////////////////

const bucketAppend = `
UPDATE buckets
SET providers = array_append(providers, $2)
WHERE name = $1
`

const providerAppend = `
UPDATE providers
SET buckets = array_append(buckets, $2), available = $3
WHERE id = $1
`

const bucketRemove = `
UPDATE buckets
SET providers = array_remove(providers, $2)
WHERE name = $1 AND $2 = ANY (providers)
`

const providerRemove = `
UPDATE providers
SET buckets = array_remove(buckets, $2), available = $3
WHERE id = $1 and $2 = ANY (buckets)
`

// Allocates a bucket to a provider.
// This information is denormalized, stored in the database twice, so that
// caching does not require tracking query results.
// This method also updates available space on the provider.
// If there is no such bucket, no such provider, or not enough space
// on the provider, this returns an error.
func (db *Database) Allocate(bucketName string, providerID uint64) error {
	// Check that the provider has enough space for the bucket
	bucket := db.getBucketTx(bucketName)
	if bucket == nil {
		return fmt.Errorf("cannot allocate nonexistent bucket: %s", bucketName)
	}
	if bucket.HasProvider(providerID) {
		return fmt.Errorf("bucket %s is already allocated to provider %d",
			bucketName, providerID)
	}
	provider := db.getProviderTx(providerID)
	if provider == nil {
		return fmt.Errorf("cannot allocate to nonexistent provider: %d", providerID)
	}
	if provider.HasBucket(bucketName) {
		util.Logger.Fatalf("bucket %s is allocated to provider %d but not vice versa",
			bucketName, providerID)
	}
	if provider.Available < bucket.Size {
		return fmt.Errorf("cannot allocate bucket of size %d to provider with %d available",
			bucket.Size, provider.Available)
	}
	newAvailable := provider.Available - bucket.Size

	// Point the bucket to the provider
	res, err := db.execTx(bucketAppend, bucketName, providerID)
	check(err)
	count, err := res.RowsAffected()
	check(err)
	if count != 1 {
		panic("db race condition on bucket in bucket allocation")
	}

	// Point the provider to the bucket
	res, err = db.execTx(providerAppend, providerID, bucketName, newAvailable)
	check(err)
	count, err = res.RowsAffected()
	check(err)
	if count != 1 {
		return fmt.Errorf("cannot allocate to nonexistent provider: %d", providerID)
	}

	return nil
}

// Deallocates a bucket from a provider.
// This information is denormalized, stored in the database twice, so that
// caching does not require tracking query results.
// If there is either no such bucket or no such provider, returns an error.
// This updates available space.
func (db *Database) Deallocate(bucketName string, providerID uint64) error {
	// Figure out how much space will be available after the deallocation
	bucket := db.getBucketTx(bucketName)
	if bucket == nil {
		return fmt.Errorf("cannot deallocate nonexistent bucket: %s", bucketName)
	}
	provider := db.getProviderTx(providerID)
	if provider == nil {
		return fmt.Errorf("cannot deallocate from nonexistent provider: %d", providerID)
	}
	newAvailable := provider.Available + bucket.Size
	if newAvailable > provider.Capacity {
		util.Logger.Fatalf("data inconsistency problem: provider %#v is oversubscribed", provider)
	}

	// Unpoint the bucket to the provider
	res, err := db.execTx(bucketRemove, bucketName, providerID)
	check(err)
	count, err := res.RowsAffected()
	check(err)
	if count != 1 {
		return fmt.Errorf("bucket %s is not allocated to provider %d", bucketName, providerID)
	}

	// Unpoint the provider to the bucket
	res, err = db.execTx(providerRemove, providerID, bucketName, newAvailable)
	check(err)
	count, err = res.RowsAffected()
	check(err)
	if count != 1 {
		return fmt.Errorf("provider %d is not storing bucket %s", providerID, bucketName)
	}

	return nil
}
