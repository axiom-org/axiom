package data

import (
	"fmt"
	"strings"
)

type BucketQuery struct {
	Name     string   `json:"name"`
	Names    []string `json:"names"`
	Owner    string   `json:"owner"`
	Provider uint64   `json:"provider"`
	Limit    int      `json:"limit"`
}

func (q *BucketQuery) String() string {
	parts := []string{}
	if q.Name != "" {
		parts = append(parts, fmt.Sprintf("name=%s", q.Name))
	}
	if len(q.Names) > 0 {
		parts = append(parts, strings.Join(q.Names, ","))
	}
	if q.Owner != "" {
		parts = append(parts, fmt.Sprintf("owner=%s", q.Owner))
	}
	if q.Provider != 0 {
		parts = append(parts, fmt.Sprintf("provider=%d", q.Provider))
	}
	if q.Limit != 0 {
		parts = append(parts, fmt.Sprintf("limit=%d", q.Limit))
	}
	if len(parts) == 0 {
		return "<empty>"
	}
	return strings.Join(parts, " ")
}
