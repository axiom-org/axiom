package data

import (
	"database/sql/driver"
	"fmt"
	"net/url"
	"regexp"
	"strings"

	"github.com/lacker/coinkit/util"
)

type Bucket struct {
	Name  string `json:"name"`
	Owner string `json:"owner"`

	// Measured in megabytes
	Size uint32 `json:"size"`

	// The magnet URI to get this bucket from
	Magnet string `json:"magnet"`

	Providers ProviderArray `json:"providers"`
}

var validBucketName = regexp.MustCompile("^[-a-zA-Z0-9]+$")

// Bucket names must be valid domain names, and can't begin or end with hyphen
func IsValidBucketName(s string) bool {
	if !validBucketName.MatchString(s) {
		return false
	}
	if strings.HasPrefix(s, "-") || strings.HasSuffix(s, "-") {
		return false
	}
	return true
}

// Magnet URIs must be valid urls and start with "magnet:"
func IsValidMagnet(m string) bool {
	if !strings.HasPrefix(m, "magnet:") {
		return false
	}
	_, err := url.ParseRequestURI(m)
	return err == nil
}

// Joins and '-quotes string names
func joinBucketNamesForSQL(names []string) string {
	parts := []string{}
	for _, name := range names {
		if !IsValidBucketName(name) {
			util.Logger.Fatalf("bad bucket name in join: %s", name)
		}
		parts = append(parts, fmt.Sprintf("'%s'", name))
	}
	return strings.Join(parts, ",")
}

func (b *Bucket) String() string {
	return fmt.Sprintf("bucket:%s, size:%d", b.Name, b.Size)
}

func (b *Bucket) IsValidNewBucket() bool {
	// Check fields that must be filled
	if b == nil || !IsValidBucketName(b.Name) || b.Owner == "" || b.Size == 0 {
		return false
	}

	// New buckets should always be unallocated
	if len(b.Providers) > 0 {
		return false
	}

	return true
}

func (b *Bucket) HasProvider(id uint64) bool {
	for _, p := range b.Providers {
		if p.ID == id {
			return true
		}
	}
	return false
}

func (b *Bucket) RemoveProvider(id uint64) {
	providers := []*Provider{}
	for _, p := range b.Providers {
		if p.ID != id {
			providers = append(providers, p)
		}
	}
	b.Providers = providers
}

// Makes a copy of this bucket with all of the provider data removed except provider IDs.
func (b *Bucket) StripProviderData() *Bucket {
	ps := []*Provider{}
	for _, p := range b.Providers {
		ps = append(ps, &Provider{
			ID: p.ID,
		})
	}
	copy := new(Bucket)
	*copy = *b
	copy.Providers = ps
	return copy
}

func (b *Bucket) CheckEqual(other *Bucket) error {
	if b == nil && other == nil {
		return nil
	}
	if b == nil || other == nil {
		return fmt.Errorf("b != other. b is %+v, other is %+v", b, other)
	}
	if b.Name != other.Name {
		return fmt.Errorf("name %s != name %s", b.Name, other.Name)
	}
	if b.Owner != other.Owner {
		return fmt.Errorf("owner %s != owner %s", b.Owner, other.Owner)
	}
	if b.Size != other.Size {
		return fmt.Errorf("size %d != size %d", b.Size, other.Size)
	}
	return b.Providers.CheckEqual(other.Providers)
}

// Value and Scan let a BucketArray map to a sql text[] with just bucket names
type BucketArray []*Bucket

func (bs BucketArray) Value() (driver.Value, error) {
	strs := []string{}
	for _, b := range bs {
		if !IsValidBucketName(b.Name) {
			util.Logger.Fatalf("should not write bad name %s to the db", b.Name)
		}
		// TODO: escape things properly here.
		// We can avoid for now because bucket names are restricted
		strs = append(strs, fmt.Sprintf("\"%s\"", b.Name))
	}
	answer := fmt.Sprintf("{%s}", strings.Join(strs, ","))
	return answer, nil
}

func (bs *BucketArray) Scan(src interface{}) error {
	if src == nil {
		return nil
	}
	bytes, ok := src.([]byte)
	if !ok {
		return fmt.Errorf("expected bytes from sql for bucket array but got: %#v", src)
	}
	str := string(bytes)
	// TODO: unescape things properly. We can avoid for now because bucket names are restricted
	trimmed := strings.Trim(str, "{}")
	strs := strings.Split(trimmed, ",")
	answer := []*Bucket{}
	for _, quoted := range strs {
		if quoted == "" {
			continue
		}
		name := strings.Trim(quoted, "\"")
		if !IsValidBucketName(name) {
			util.Logger.Fatalf("bad bucket name in the db: %s", name)
		}
		answer = append(answer, &Bucket{
			Name: name,
		})
	}
	*bs = answer
	return nil
}

func (bs BucketArray) CheckEqual(other BucketArray) error {
	if len(bs) != len(other) {
		return fmt.Errorf("len %d != len %d", len(bs), len(other))
	}
	for i, b := range bs {
		err := b.CheckEqual(other[i])
		if err != nil {
			return err
		}
	}
	return nil
}
