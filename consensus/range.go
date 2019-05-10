package consensus

// Simple utilities for dealing with ranges of numbers
// In general, ranges are inclusive of their endpoints and 0, 0 is
// used for the null range.

func RangeUnion(min1 int, max1 int, min2 int, max2 int) (int, int) {
	if min1 == 0 || max1 == 0 {
		return min2, max2
	}
	if min2 == 0 || max2 == 0 {
		return min1, max1
	}
	var min int
	if min1 < min2 {
		min = min1
	} else {
		min = min2
	}
	var max int
	if max1 > max2 {
		max = max1
	} else {
		max = max2
	}
	return min, max
}


func MakeRange(numbers ...int) (int, int) {
	min, max := 0, 0
	for _, n := range numbers {
		if n < 0 {
			panic("n < 0 not allowed in MakeRange")
		}
		min, max = RangeUnion(min, max, n, n)
	}
	return min, max
}
