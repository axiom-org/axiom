package data

import (
	"log"
	"testing"

	"github.com/axiom-org/axiom/consensus"
)

func TestInsertAndGet(t *testing.T) {
	db := NewTestDatabase(0)
	qs, _ := consensus.MakeTestQuorumSlice(4)
	block := &Block{
		Slot:  1,
		Chunk: &LedgerChunk{},
		C:     7,
		H:     8,
		D:     qs,
	}
	err := db.InsertBlock(block)
	if err != nil {
		t.Fatal(err)
	}
	db.Commit()
	if db.GetBlock(4) != nil {
		t.Fatal("block should be nonexistent")
	}
	b2 := db.GetBlock(1)
	if b2.C != block.C {
		t.Fatalf("block changed: %+v -> %+v", block, b2)
	}
	if b2.Chunk == nil {
		t.Fatalf("block chunk was nil on retrieval")
	}
	if b2.D == nil {
		t.Fatalf("block quorum slice was nil on retrieval")
	}
}

func TestCantInsertTwice(t *testing.T) {
	db := NewTestDatabase(0)
	block := &Block{
		Slot:  1,
		Chunk: &LedgerChunk{},
		C:     1,
		H:     2,
	}
	err := db.InsertBlock(block)
	if err != nil {
		t.Fatal(err)
	}
	err = db.InsertBlock(block)
	if err == nil {
		t.Fatal("a block should not save twice")
	}

	if db.LastBlock() != nil {
		t.Fatal("insert should not have worked without commit")
	}
	db.Rollback()
	err = db.InsertBlock(block)
	if err != nil {
		t.Fatal(err)
	}
	db.Commit()
	if db.LastBlock() == nil {
		t.Fatal("insert should work after rollback")
	}
}

func TestLastBlock(t *testing.T) {
	db := NewTestDatabase(0)
	b := db.LastBlock()
	if b != nil {
		t.Fatalf("expected last block nil but got %+v", b)
	}
	op := makeTestSendOperation(1)
	b = &Block{
		Slot: 1,
		Chunk: &LedgerChunk{
			Operations: []*SignedOperation{op},
		},
	}
	err := db.InsertBlock(b)
	if err != nil {
		t.Fatal(err)
	}

	// Before commit, the insert should not be visible
	b2 := db.LastBlock()
	if b2 != nil {
		t.Fatalf("expected b2 nil but got: %+v", b2)
	}
	db.Commit()
	b.Slot = 2
	err = db.InsertBlock(b)
	if err != nil {
		t.Fatal(err)
	}
	db.Commit()
	b3 := db.LastBlock()
	if b3.Slot != b.Slot {
		t.Fatalf("b3: %+v", b3)
	}

	// We should also be able to retrieve it with a query on the slot
	qm := &QueryMessage{
		Block: b.Slot,
	}
	dm, _ := db.HandleQueryMessage(qm)
	if dm == nil {
		t.Fatalf("got nil data message")
	}
	b4 := dm.Blocks[b.Slot]
	if b4 == nil || b4.Slot != b.Slot {
		t.Fatalf("got bad data message: %+v", dm)
	}

	// We should be able to retrieve the op by signature
	qm = &QueryMessage{
		Signature: op.Signature,
	}
	dm, _ = db.HandleQueryMessage(qm)
	if dm == nil {
		t.Fatalf("got nil data message")
	}

	sop := dm.Operations[op.Signature]
	if op == nil || sop.Signature != op.Signature {
		t.Fatalf("got bad op in data message: %+v", dm)
	}
}

func TestForBlocks(t *testing.T) {
	db := NewTestDatabase(0)
	for i := 1; i <= 5; i++ {
		b := &Block{
			Slot:  i,
			Chunk: &LedgerChunk{},
			C:     7,
		}
		if db.InsertBlock(b) != nil {
			t.Fatal("block could not save")
		}
		db.Commit()
	}
	count := db.ForBlocks(func(b *Block) {
		if b.C != 7 {
			t.Fatal("expected C = 7")
		}
	})
	if count != 5 {
		t.Fatal("expected count = 5")
	}
	log.Print(db.TotalSizeInfo())
}

func TestGetDocuments(t *testing.T) {
	db := NewTestDatabase(0)
	for a := 1; a <= 2; a++ {
		for b := 1; b <= 2; b++ {
			d := NewDocument(uint64(10*a+b), map[string]interface{}{
				"a": a,
				"b": b,
			})
			err := db.InsertDocument(d)
			if err != nil {
				t.Fatal(err)
			}
		}
	}
	docs, slot := db.GetDocuments(map[string]interface{}{"a": 2, "b": 1}, 2)
	if slot != 0 {
		t.Fatalf("wrong slot: %d", slot)
	}
	if len(docs) != 0 {
		t.Fatal("expected no docs visible before commit")
	}
	db.Commit()
	docs, _ = db.GetDocuments(map[string]interface{}{"a": 2, "b": 1}, 2)
	if len(docs) != 1 {
		t.Fatalf("expected one doc but got: %+v", docs)
	}
}

func TestGetDocumentsNoResults(t *testing.T) {
	db := NewTestDatabase(0)
	docs, _ := db.GetDocuments(map[string]interface{}{"blorp": "hi"}, 3)
	if len(docs) != 0 {
		t.Fatalf("expected zero docs but got: %+v", docs)
	}
}

func TestDocumentOperations(t *testing.T) {
	db := NewTestDatabase(0)
	d := NewDocument(uint64(3), map[string]interface{}{
		"number": 3,
	})
	err := db.InsertDocument(d)
	if err != nil {
		t.Fatal(err)
	}
	db.Commit()
	d.Data.Set("number", 4)
	db.SetDocument(d)
	db.Commit()
	docs, _ := db.GetDocuments(map[string]interface{}{"number": 4}, 2)
	if len(docs) != 1 {
		t.Fatalf("could not find newly-set document")
	}

	data := NewEmptyJSONObject()
	data.Set("number", 5)
	db.UpdateDocument(uint64(3), data)
	db.Commit()

	// Check it updated
	docs, _ = db.GetDocuments(map[string]interface{}{"number": 5}, 2)
	if len(docs) != 1 {
		t.Fatalf("unexpectedly found %d docs", len(docs))
	}

	// Double-check
	doc := db.GetDocument(3)
	number, _ := doc.Data.GetInt("number")
	if number != 5 {
		t.Fatalf("expected number to be 5 but it was %d", number)
	}

	// Try to update a nonexistent document
	err = db.UpdateDocument(uint64(4), data)
	if err == nil {
		t.Fatalf("UpdateDocument should error on nonexistent document")
	}

	// Delete the document
	check(db.DeleteDocument(3))
	db.Commit()

	// Check it deleted
	doc = db.GetDocument(3)
	if doc != nil {
		t.Fatalf("the delete operation did not delete the document")
	}
}

func TestSetNonexistentDocument(t *testing.T) {
	db := NewTestDatabase(0)
	doc := NewDocument(uint64(4), map[string]interface{}{
		"number": 4,
	})
	err := db.SetDocument(doc)
	if err == nil {
		t.Fatalf("setting a nonexistent doc should error")
	}
	db.Commit()
	docs, _ := db.GetDocuments(map[string]interface{}{"number": 4}, 2)
	if len(docs) != 0 {
		t.Fatalf("setting a nonexistent doc should be a no-op")
	}
}

const benchmarkMax = 400

func databaseForBenchmarking() *Database {
	db := NewTestDatabase(0)
	log.Printf("populating db for benchmarking")
	items := 0
	for a := 0; a < benchmarkMax; a++ {
		if a != 0 && a%10 == 0 {
			log.Printf("inserted %d items", items)
		}
		for b := 0; b < benchmarkMax; b++ {
			c := b*benchmarkMax + a + 1
			d := NewDocument(uint64(c), map[string]interface{}{
				"a": a,
				"b": b,
				"c": c,
			})
			check(db.InsertDocument(d))
			items++
		}
	}
	log.Printf("database is populated with %d items", items)
	return db
}

func BenchmarkOneConstraint(b *testing.B) {
	db := databaseForBenchmarking()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		c := i%(benchmarkMax*benchmarkMax) + 1
		docs, _ := db.GetDocuments(map[string]interface{}{"c": c}, 2)
		if len(docs) != 1 {
			log.Fatalf("expected one doc for c = %d but got: %+v", c, docs)
		}
	}
}

func BenchmarkTwoConstraints(b *testing.B) {
	db := databaseForBenchmarking()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		a := i % benchmarkMax
		b := ((i - a) / benchmarkMax) % benchmarkMax
		docs, _ := db.GetDocuments(map[string]interface{}{"a": a, "b": b}, 2)
		if len(docs) != 1 {
			log.Fatalf("expected one doc but got: %+v", docs)
		}
	}
}

func TestMaxBalance(t *testing.T) {
	db := NewTestDatabase(0)
	mb := db.MaxBalance()
	if mb != 0 {
		t.Fatalf("got max balance %d but expected 0", mb)
	}

	a := &Account{
		Owner:    "alex",
		Sequence: 1,
		Balance:  10,
	}
	b := &Account{
		Owner:    "bob",
		Sequence: 2,
		Balance:  5,
	}
	db.UpsertAccount(a)
	db.UpsertAccount(b)
	mb = db.MaxBalance()
	if mb != 0 {
		t.Fatalf("got max balance %d before commit, but expected 0", mb)
	}

	db.Commit()
	mb = db.MaxBalance()
	if mb != 10 {
		t.Fatalf("got max balance %d", mb)
	}
}

func TestAccounts(t *testing.T) {
	db := NewTestDatabase(0)
	if db.GetAccount("bob") != nil {
		t.Fatalf("db should be empty")
	}
	nothing := func(a *Account) {}
	if db.ForAccounts(nothing) != 0 {
		t.Fatalf("ForAccounts on empty db should be 0")
	}
	a := &Account{
		Owner:    "bob",
		Sequence: 3,
		Balance:  4,
	}
	db.UpsertAccount(a)
	db.Commit()
	if db.GetAccount("bob") == nil {
		t.Fatalf("bob should exist now")
	}
	numAccounts := db.ForAccounts(nothing)
	if numAccounts != 1 {
		t.Fatalf("there should be 1 thing in the db now, but there was %d", numAccounts)
	}
	a.Owner = "bob2"
	db.UpsertAccount(a)
	db.Commit()
	if db.ForAccounts(nothing) != 2 {
		t.Fatalf("there should be 2 things in the db now")
	}
	m := &QueryMessage{
		Account: "bob",
	}
	dm, _ := db.HandleQueryMessage(m)
	if dm == nil || dm.I != 0 || dm.Accounts["bob"].Balance != 4 {
		t.Fatalf("got unexpected data message: %+v", dm)
	}
}

func TestBuckets(t *testing.T) {
	db := NewTestDatabase(0)

	if db.getBucketTx("foo") != nil {
		t.Fatalf("getBucketTx should return nil on empty db")
	}

	check(db.InsertBucket(&Bucket{
		Name:  "mybucket",
		Owner: "bob",
		Size:  150,
	}))
	check(db.UpdateBucket(&Bucket{
		Name:   "mybucket",
		Magnet: "magnet://example.com/mybucket",
	}))
	check(db.InsertBucket(&Bucket{
		Name:  "jimsbucket",
		Owner: "jim",
		Size:  150,
	}))

	if db.GetBucket("mybucket") != nil {
		t.Fatalf("mybucket should not be visible before commit")
	}

	db.Commit()

	if db.GetBucket("blorp") != nil {
		t.Fatalf("there should be no bucket named blorp")
	}
	b := db.GetBucket("mybucket")
	if b.Owner != "bob" {
		t.Fatalf("GetBucket got %+v", b)
	}
	if b.Magnet != "magnet://example.com/mybucket" {
		t.Fatalf("GetBucket missing magnet: %+v", b)
	}

	for i := uint64(1); i <= 4; i++ {
		cap := uint32(500 - 100*i)
		check(db.InsertProvider(&Provider{
			Owner:     "ricky",
			Capacity:  cap,
			Available: cap,
			ID:        i,
		}))
	}
	check(db.Allocate("mybucket", 1))
	check(db.Allocate("mybucket", 3))
	err := db.Allocate("mybucket", 4)
	if err == nil {
		t.Fatalf("should fail to allocate when not enough space")
	}
	db.Commit()

	err = db.DeleteBucket("mybucket")
	db.Commit()
	if err == nil {
		t.Fatalf("a bucket with allocations should not be deletable")
	}

	type pair struct {
		query *BucketQuery
		count int
	}

	pairs := []pair{
		pair{
			query: &BucketQuery{
				Owner: "bob",
			},
			count: 1,
		},
		pair{
			query: &BucketQuery{
				Owner: "bob",
				Name:  "mybucket",
			},
			count: 1,
		},
		pair{
			query: &BucketQuery{
				Names: []string{"mybucket", "jimsbucket", "zorpsbucket"},
			},
			count: 2,
		},
		pair{
			query: &BucketQuery{
				Name: "mybucket",
			},
			count: 1,
		},
		pair{
			query: &BucketQuery{
				Owner: "zeke",
				Name:  "mybucket",
			},
			count: 0,
		},
		pair{
			query: &BucketQuery{
				Owner: "bob",
				Name:  "zorp",
			},
			count: 0,
		},
		pair{
			query: &BucketQuery{
				Owner: "zeke",
			},
			count: 0,
		},
		pair{
			query: &BucketQuery{
				Name: "zorp",
			},
			count: 0,
		},
		pair{
			query: &BucketQuery{
				Owner: "Bob",
			},
			count: 0,
		},
		pair{
			query: &BucketQuery{
				Name: "MyBucket",
			},
			count: 0,
		},
		pair{
			query: &BucketQuery{
				Provider: 1,
			},
			count: 1,
		},
		pair{
			query: &BucketQuery{
				Provider: 2,
			},
			count: 0,
		},
		pair{
			query: &BucketQuery{
				Provider: 3,
			},
			count: 1,
		},
		pair{
			query: &BucketQuery{
				Provider: 4,
			},
			count: 0,
		},
	}

	for _, pair := range pairs {
		buckets, _ := db.GetBuckets(pair.query)
		if len(buckets) != pair.count {
			t.Fatalf("query %+v got %d results but expected %d",
				pair.query, len(buckets), pair.count)
		}
	}

	qm := &QueryMessage{
		Buckets: &BucketQuery{
			Owner: "bob",
		},
	}
	dm, _ := db.HandleQueryMessage(qm)
	if len(dm.Buckets) != 1 {
		t.Fatalf("failed to HandleQueryMessage: %+v", qm)
	}
	bucket := dm.Buckets[0]
	if len(bucket.Providers) != 2 {
		t.Fatalf("failed to retrieve providers")
	}

	check(db.Deallocate("mybucket", 1))
	check(db.Deallocate("mybucket", 3))
	check(db.DeleteBucket("mybucket"))
	db.Commit()
}

func TestProviders(t *testing.T) {
	db := NewTestDatabase(0)

	p := &Provider{
		Owner:     "bob",
		Capacity:  100,
		Available: 100,
		ID:        1,
	}

	check(db.InsertProvider(p))
	p.ID = 2
	p.Capacity = 200
	p.Available = 200
	check(db.InsertProvider(p))

	b := &Bucket{
		Name:  "bucket1",
		Owner: "jim",
		Size:  7,
	}
	check(db.InsertBucket(b))

	check(db.Allocate("bucket1", 1))

	db.Commit()

	err := db.DeleteProvider(1)
	db.Commit()
	if err == nil {
		t.Fatalf("should not be able to delete a provider with allocations")
	}

	err = db.Allocate("bucket1", 1)
	db.Commit()
	if err == nil {
		t.Fatalf("should not be able to double-allocate")
	}

	b = db.GetBucket("bucket1")
	if b == nil || len(b.Providers) != 1 {
		t.Fatalf("expected one provider for %#v", b)
	}

	for _, q := range []*ProviderQuery{
		&ProviderQuery{Owner: "bob"},
		&ProviderQuery{IDs: []uint64{1, 2}},
		&ProviderQuery{Available: 50},
	} {
		ps, _ := db.GetProviders(q)
		if len(ps) != 2 {
			t.Fatalf("GetProviders returned: %+v", ps)
		}
	}

	check(db.AddCapacity(1, 100))
	db.Commit()

	p = db.GetProvider(1)
	if p.Capacity != 200 {
		t.Fatalf("AddCapacity failed: %+v", p)
	}

	ps, _ := db.GetProviders(&ProviderQuery{Bucket: "bucket1"})
	if len(ps) != 1 {
		t.Fatalf("failed to search for provider based on bucket")
	}

	check(db.Deallocate("bucket1", 1))
	db.Commit()

	p = db.GetProvider(1)
	if p.Available != p.Capacity {
		t.Fatalf("deallocating should have freed up available space: #%v", p)
	}

	b = db.GetBucket("bucket1")
	if len(b.Providers) != 0 {
		t.Fatalf("expected zero providers for %#v", b)
	}

	p = db.GetProvider(2)
	if p.Capacity != 200 {
		t.Fatalf("bad provider data: %#v", p)
	}
	check(db.DeleteProvider(2))
	db.Commit()

	ps, _ = db.GetProviders(&ProviderQuery{Owner: "bob"})
	if len(ps) != 1 {
		t.Fatalf("delete did not seem to delete")
	}

	qm := &QueryMessage{
		Providers: &ProviderQuery{
			ID: 1,
		},
	}
	dm, _ := db.HandleQueryMessage(qm)
	if len(dm.Providers) != 1 {
		t.Fatalf("failed to HandleQueryMessage: %+v", qm)
	}
}
