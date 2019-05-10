package data

import (
	"fmt"
)

type TestingOperation struct {
	Number  int    `json:"number"`
	Signer  string `json:"signer"`
	Invalid bool   `json:"invalid"`
}

func (op *TestingOperation) OperationType() string {
	return "Testing"
}

func (op *TestingOperation) String() string {
	return "Testing"
}

func (op *TestingOperation) GetSigner() string {
	return op.Signer
}

func (op *TestingOperation) Verify() error {
	if op.Invalid {
		return fmt.Errorf("op.Invalid is set to true, so this op fails to verify")
	}
	return nil
}

func (op *TestingOperation) GetFee() uint64 {
	return 0
}

func (op *TestingOperation) GetSequence() uint32 {
	return 1
}

func init() {
	RegisterOperationType(&TestingOperation{})
}
