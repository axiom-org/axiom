package consensus

import (
	"strings"
	"testing"
)

func testWithSeed(seed string, t *testing.T) {
	a1 := []string{"foo", "bar", "baz", "1", "2", "qux"}
	b1 := []string{"bar", "1", "2", "qux", "foo", "baz"}

	a2 := SeedSort(seed, a1)
	b2 := SeedSort(seed, b1)
	if strings.Join(a2, ",") != strings.Join(b2, ",") {
		t.Fatalf("a2: %+v, b2: %+v", a2, b2)
	}
}

func TestSeedSort(t *testing.T) {
	testWithSeed("", t)
	testWithSeed("3729817328937218973289173281937", t)
	testWithSeed(" - - - - ", t)
	testWithSeed("yolp", t)
	testWithSeed("boink", t)
	testWithSeed("prop", t)
	testWithSeed("\\", t)
	testWithSeed("00000000000000", t)
	testWithSeed("null", t)
	testWithSeed("aieeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", t)
}
