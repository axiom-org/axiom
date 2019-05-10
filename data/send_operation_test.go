package data

import (
	"testing"
)

func TestMakeTestSendOperation(t *testing.T) {
	st := makeTestSendOperation(0)
	if st.Verify() != nil {
		t.Fatal("should verify")
	}
}
