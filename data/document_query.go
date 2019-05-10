package data

import (
	"github.com/axiom-org/axiom/util"
)

// A DocumentQuery expresses a way to select a subset of documents.
type DocumentQuery struct {
	// Each field in data expresses an exact match with the data of the object to
	// be retrieved.
	Data *JSONObject `json:"data"`

	// The maximum number of objects to be returned.
	// It's up to individual servers what the maximum supported limit is.
	Limit int `json:"limit"`
}

func (q *DocumentQuery) String() string {
	return string(util.ToJSON(q))
}
