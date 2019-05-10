package util

import (
	"sync"
)

// A SafeSet is threadsafe.
type SafeSet struct {
	mutex sync.Mutex
	data  map[string]bool
}

func NewSafeSet() *SafeSet {
	return &SafeSet{
		data: make(map[string]bool),
	}
}

func (set *SafeSet) Add(s string) {
	set.mutex.Lock()
	defer set.mutex.Unlock()

	set.data[s] = true
}

func (set *SafeSet) Remove(s string) {
	set.mutex.Lock()
	defer set.mutex.Unlock()

	delete(set.data, s)
}

func (set *SafeSet) Contains(s string) bool {
	set.mutex.Lock()
	defer set.mutex.Unlock()

	_, ok := set.data[s]
	return ok
}

func (set *SafeSet) Size() int {
	set.mutex.Lock()
	defer set.mutex.Unlock()

	return len(set.data)
}

func (set *SafeSet) Items() []string {
	set.mutex.Lock()
	defer set.mutex.Unlock()

	answer := []string{}
	for item, _ := range set.data {
		answer = append(answer, item)
	}
	return answer
}
