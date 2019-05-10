package data

import (
	"database/sql/driver"
	"fmt"
	"strconv"
	"strings"
)

type Provider struct {
	// Every provider gets a unique id, assigned by the blockchain.
	ID uint64 `json:"id"`

	Owner string `json:"owner"`

	// The total space this provider can provider. Measured in megabytes.
	Capacity uint32 `json:"capacity"`

	// The current available space on this provider.
	Available uint32 `json:"available"`

	// The buckets this provider is currently providing.
	Buckets BucketArray `json:"buckets"`
}

func (p *Provider) String() string {
	return fmt.Sprintf("provider #%d, owner:%s, capacity:%d, available:%d",
		p.ID, p.Owner, p.Capacity, p.Available)
}

func (p *Provider) IsValidNewProvider() bool {
	// Check fields that must be filled
	if p == nil || p.Owner == "" || p.Capacity == 0 || p.ID == 0 {
		return false
	}

	// New providers should always be empty
	if p.Capacity != p.Available {
		return false
	}
	if len(p.Buckets) > 0 {
		return false
	}

	return true
}

func (p *Provider) HasBucket(name string) bool {
	for _, b := range p.Buckets {
		if b.Name == name {
			return true
		}
	}
	return false
}

// Does not modify Available
func (p *Provider) RemoveBucket(name string) {
	buckets := []*Bucket{}
	for _, b := range p.Buckets {
		if b.Name != name {
			buckets = append(buckets, b)
		}
	}
	p.Buckets = buckets
}

func (p *Provider) CheckEqual(other *Provider) error {
	if p == nil && other == nil {
		return nil
	}
	if p == nil || other == nil {
		return fmt.Errorf("p != other. p is %+v, other is %+v", p, other)
	}
	if p.ID != other.ID {
		return fmt.Errorf("id %d != id %d", p.ID, other.ID)
	}
	if p.Owner != other.Owner {
		return fmt.Errorf("owner %s != owner %s", p.Owner, other.Owner)
	}
	if p.Capacity != other.Capacity {
		return fmt.Errorf("capacity %d != capacity %d", p.Capacity, other.Capacity)
	}
	if p.Available != other.Available {
		return fmt.Errorf("available %d != available %d", p.Available, other.Available)
	}
	return nil
}

// Value and Scan let a ProviderArray map to a sql bigint[] with only ids
type ProviderArray []*Provider

func (ps ProviderArray) Value() (driver.Value, error) {
	strs := []string{}
	for _, p := range ps {
		strs = append(strs, fmt.Sprintf("%d", p.ID))
	}
	answer := fmt.Sprintf("{%s}", strings.Join(strs, ","))
	return answer, nil
}

func (ps *ProviderArray) Scan(src interface{}) error {
	if src == nil {
		return nil
	}
	bytes, ok := src.([]byte)
	if !ok {
		return fmt.Errorf("expected bytes from sql for provider array but got: %#v", src)
	}
	str := string(bytes)
	trimmed := strings.Trim(str, "{}")
	strs := strings.Split(trimmed, ",")
	answer := []*Provider{}
	for _, str := range strs {
		if str == "" {
			continue
		}
		i, err := strconv.ParseUint(str, 10, 64)
		if err != nil {
			return err
		}
		answer = append(answer, &Provider{
			ID: i,
		})
	}
	*ps = answer
	return nil
}

func (ps ProviderArray) CheckEqual(other ProviderArray) error {
	if len(ps) != len(other) {
		return fmt.Errorf("len %d != len %d", len(ps), len(other))
	}
	for i, p := range ps {
		err := p.CheckEqual(other[i])
		if err != nil {
			return err
		}
	}
	return nil
}
