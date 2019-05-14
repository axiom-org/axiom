package data

import (
	"testing"

	"github.com/axiom-org/axiom/util"
)

func TestSendOperationProcessing(t *testing.T) {
	c := NewCache()
	payBob := &SendOperation{
		Sequence: 1,
		Amount:   100,
		Fee:      3,
		Signer:   "alice",
		To:       "bob",
	}
	if c.Validate(payBob) == nil {
		t.Fatalf("alice should not be able to pay bob with no account")
	}
	c.SetBalance("alice", 50)
	if c.Validate(payBob) == nil {
		t.Fatalf("alice should not be able to pay bob with only 50 money")
	}
	c.SetBalance("alice", 200)
	if c.Validate(payBob) != nil {
		t.Fatalf("alice should be able to pay bob with 200 money")
	}
	if c.Process(payBob) != nil {
		t.Fatalf("the payment should have worked")
	}
	if c.Validate(payBob) == nil {
		t.Fatalf("validation should reject replay attacks")
	}
}

func TestReadThrough(t *testing.T) {
	db := NewTestDatabase(0)
	c1 := NewDatabaseCache(db, 1, 1)
	a1 := c1.GetAccount("bob")
	if a1 != nil {
		t.Fatalf("expected nil account, got %+v", a1)
	}
	c2 := NewDatabaseCache(db, 1, 1)
	a2 := &Account{
		Owner:    "bob",
		Sequence: 7,
		Balance:  100,
	}
	db.UpsertAccount(a2)
	db.Commit()
	a3 := c1.GetAccount("bob")
	if a3 != nil {
		t.Fatalf("expected c1 to not do read-through when cache is warm")
	}
	a4 := c2.GetAccount("bob")
	if a4 == nil || a4.Balance != 100 {
		t.Fatalf("bad a4: %+v", a4)
	}

	if c2.GetAccount("nonexistent") != nil {
		t.Fatalf("nonexistent existed")
	}
	prereads := db.reads
	if c2.GetAccount("nonexistent") != nil {
		t.Fatalf("nonexistent existed")
	}
	if prereads != db.reads {
		t.Fatalf("double nil read should not require a db hit")
	}

	if c1.BucketExists("hello") {
		t.Fatalf("hello bucket should not exist")
	}
	copy := c1.CowCopy()
	if copy.BucketExists("hello") {
		t.Fatalf("hello bucket should not exist on CowCopy either")
	}
}

func TestValidation(t *testing.T) {
	c := NewCache()
	mint := util.NewKeyPairFromSecretPhrase("mint")
	c.UpsertAccount(&Account{
		Owner:   mint.PublicKey().String(),
		Balance: 1000000,
	})
	c.UpsertAccount(&Account{
		Owner:   "jimmy",
		Balance: 10000,
	})

	// First create a document
	op := MakeTestCreateDocumentOperation(2).Operation
	if c.Validate(op) == nil {
		t.Fatalf("should get rejected for bad sequence")
	}
	op = MakeTestCreateDocumentOperation(1).Operation
	if c.Process(op) != nil {
		t.Fatalf("should be a valid create, id = 1 seq = 1")
	}

	// Check our doc is there
	doc := c.GetDocument(1)
	foo, ok := doc.Data.GetInt("foo")
	if !ok || foo != 1 {
		t.Fatalf("expected doc.Data.foo to be 1")
	}

	// Update our document
	badId := uint64(100)
	if c.Validate(MakeTestUpdateDocumentOperation(badId, 2).Operation) == nil {
		t.Fatalf("badId for update should be bad")
	}
	if c.Validate(MakeTestUpdateDocumentOperation(1, 10).Operation) == nil {
		t.Fatalf("sequence number of 10 should be bad for update")
	}
	uop := MakeTestUpdateDocumentOperation(1, 1).Operation.(*UpdateDocumentOperation)
	uop.Signer = "jimmy"
	if c.Validate(uop) == nil {
		t.Fatalf("only the doc owner should be allowed to update")
	}
	if c.Process(MakeTestUpdateDocumentOperation(1, 2).Operation) != nil {
		t.Fatalf("update should work")
	}

	// Check our doc is updated
	doc = c.GetDocument(1)
	foo, ok = doc.Data.GetInt("foo")
	if !ok || foo != 2 {
		t.Fatalf("expected doc.Data.foo to be 2")
	}
	if doc.Owner() != mint.PublicKey().String() {
		t.Fatalf("bad doc owner: %s", doc.Owner())
	}

	// Delete our document
	if c.Validate(MakeTestDeleteDocumentOperation(badId, 3).Operation) == nil {
		t.Fatalf("badId for delete should be bad")
	}
	if c.Validate(MakeTestDeleteDocumentOperation(1, 10).Operation) == nil {
		t.Fatalf("sequence number of 10 should be bad for delete")
	}
	dop := MakeTestDeleteDocumentOperation(1, 1).Operation.(*DeleteDocumentOperation)
	dop.Signer = "jimmy"
	if c.Validate(dop) == nil {
		t.Fatalf("only the doc owner should be allowed to delete")
	}
	if c.Process(MakeTestDeleteDocumentOperation(1, 3).Operation) != nil {
		t.Fatalf("delete should work")
	}
	if c.Validate(MakeTestDeleteDocumentOperation(1, 4).Operation) == nil {
		t.Fatalf("delete-after-delete should not work")
	}
	if c.Validate(MakeTestUpdateDocumentOperation(1, 4).Operation) == nil {
		t.Fatalf("update-after-delete should not work")
	}

	// Check our doc is deleted
	doc = c.GetDocument(1)
	if doc != nil {
		t.Fatalf("doc should have been deleted")
	}
}

func TestWriteThrough(t *testing.T) {
	db := NewTestDatabase(0)
	c1 := NewDatabaseCache(db, 1, 1)
	a1 := &Account{
		Owner:    "bob",
		Sequence: 8,
		Balance:  200,
	}
	c1.UpsertAccount(a1)
	db.Commit()
	c2 := NewDatabaseCache(db, 1, 1)
	a2 := c2.GetAccount("bob")
	if a2 == nil || a2.Balance != 200 {
		t.Fatalf("writethrough fail: %+v", a2)
	}
}

func TestAllocation(t *testing.T) {
	db := NewTestDatabase(0)
	c := NewDatabaseCache(db, 1, 1)

	setup := func() {

		b := &Bucket{
			Name:  "mybucket",
			Owner: "me",
			Size:  10,
		}
		p := &Provider{
			Owner:     "megacorp",
			ID:        1,
			Capacity:  100,
			Available: 100,
		}

		c.InsertBucket(b)
		c.InsertProvider(p)
		c.Allocate("mybucket", 1)
		db.Commit()

		p2 := c.GetProvider(1)
		if p2.Available != 90 {
			t.Fatalf("unexpected provider post allocate: %+v", p2)
		}
	}

	setup()
	c.DeleteBucket("mybucket")
	db.Commit()
	if c.GetProvider(1).Available != 100 {
		t.Fatalf("provider should have freed up space")
	}
	c.DeleteProvider(1)
	db.Commit()

	setup()
	c.DeleteProvider(1)
	db.Commit()
	if len(c.GetBucket("mybucket").Providers) != 0 {
		t.Fatalf("bucket should have no providers")
	}
	url := "magnet://example.com/mybucket"
	c.SetMagnet("mybucket", url)
	db.Commit()
	if c.GetBucket("mybucket").Magnet != url {
		t.Fatalf("bucket should have magnet")
	}
	c.DeleteBucket("mybucket")
	db.Commit()
}

func TestAllocationProcessing(t *testing.T) {
	db := NewTestDatabase(0)
	c := NewDatabaseCache(db, 1, 1)

	cbop := &CreateBucketOperation{
		Sequence: 1,
		Signer:   "jim",
		Name:     "jimsbucket",
		Size:     100,
	}

	if c.Validate(cbop) == nil {
		t.Fatalf("jim should not be able to make a bucket with no account")
	}
	c.SetBalance("jim", 100)
	if c.Validate(cbop) == nil {
		t.Fatalf("jim should not be able to afford this bucket")
	}
	c.SetBalance("jim", 300000)
	if c.Process(cbop) != nil {
		t.Fatalf("jim should be able to create a bucket")
	}

	cpop := &CreateProviderOperation{
		Sequence: 1,
		Signer:   "miney",
		Capacity: 1000,
	}
	if c.Validate(cpop) == nil {
		t.Fatalf("miney should not be able to make a provider with no account")
	}
	c.SetBalance("miney", 100)
	if c.Process(cpop) != nil {
		t.Fatalf("miney should be able to make a provider")
	}

	aop := &AllocateOperation{
		Sequence:   2,
		Signer:     "jim",
		BucketName: "jimsbucket",
		ProviderID: 1,
	}
	err := c.Process(aop)
	if err != nil {
		t.Fatalf("error during allocation: %s", err)
	}

	dop := &DeallocateOperation{
		Sequence:   3,
		Signer:     "jim",
		BucketName: "jimsbucket",
		ProviderID: 1,
	}
	if c.Process(dop) != nil {
		t.Fatalf("should be able to deallocate")
	}

	ubop := &UpdateBucketOperation{
		Sequence: 4,
		Signer:   "jim",
		Name:     "jimsbucket",
		Magnet:   "magnet://example.com/x",
	}
	if c.Process(ubop) != nil {
		t.Fatalf("should be able to update bucket")
	}

	account := c.GetAccount("jim")
	if account.Storage == 0 {
		t.Fatalf("storage tracking has failed. jim's account: %+v", account)
	}

	dbop := &DeleteBucketOperation{
		Sequence: 5,
		Signer:   "jim",
		Name:     "jimsbucket",
	}
	if c.Process(dbop) != nil {
		t.Fatalf("should be able to delete bucket")
	}

	dpop := &DeleteProviderOperation{
		Sequence: 2,
		Signer:   "miney",
		ID:       1,
	}
	if c.Process(dpop) != nil {
		t.Fatalf("should be able to delete provider")
	}

	db.Commit()
}
