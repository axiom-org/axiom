package data

import (
	"encoding/json"
	"testing"
)

func assertCompareJSON(t *testing.T, x interface{}, y interface{}, expected bool) {
	xBytes, err := json.Marshal(x)
	if err != nil {
		t.Fatalf("%s", err)
	}
	yBytes, err := json.Marshal(y)
	if err != nil {
		t.Fatalf("%s", err)
	}
	xString := string(xBytes)
	yString := string(yBytes)
	if (xString == yString) != expected {
		t.Fatalf("\nLHS: %s\nRHS: %s\nexpected equality: %t", xString, yString, expected)
	}
}

func TestStripProviderData(t *testing.T) {
	bucket := &Bucket{
		Name:  "bucket1",
		Owner: "jim",
		Providers: []*Provider{
			&Provider{
				ID:    2,
				Owner: "bob",
			},
		},
		Size: 7,
	}

	stripped := bucket.StripProviderData()
	assertCompareJSON(t, bucket, stripped, false)
	stripped2 := stripped.StripProviderData()
	assertCompareJSON(t, stripped, stripped2, true)
	bucket.Providers[0].Owner = ""
	assertCompareJSON(t, bucket, stripped, true)
}

func TestIsValidBucketName(t *testing.T) {
	for _, valid := range []string{
		"89tfc7bn934ty7nb854y7GYUIGNUI",
		"bob",
		"A-Z",
		"pn----AXAX",
		"oof-------yeah",
		"Q",
	} {
		if !IsValidBucketName(valid) {
			t.Fatalf("%s should be a valid bucket name", valid)
		}
	}

	for _, invalid := range []string{
		"",
		"-bob",
		"foo-",
		"A?Z",
	} {
		if IsValidBucketName(invalid) {
			t.Fatalf("%s should be an invalid bucket name", invalid)
		}
	}
}

func TestIsValidMagnet(t *testing.T) {
	if !IsValidMagnet("magnet://example.com/x") {
		t.Fatalf("should be valid magnet")
	}
}
