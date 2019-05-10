package util

import (
	"log"
	"os"
)

// This is the one default global logger.
var Logger = log.New(os.Stderr, "", log.LstdFlags)

// Just useful for debugging
var Verbose = false

func Pluralize(word string, number int) string {
	if number == 1 {
		return word
	}
	return word + "s"
}

func Shorten(name string) string {
	length := len(name)
	if length > 6 {
		length = 6
	}
	return name[:length]
}

// Only logged if verbose is true
func Infof(format string, a ...interface{}) {
	if Verbose {
		Logger.Printf(format, a...)
	}
}

// Send logging through here so that it's easier to manage
func Logf(tag string, publicKey string, format string, a ...interface{}) {
	Logger.Printf(tag+" "+Shorten(publicKey)+" "+format, a...)
}

func Printf(format string, a ...interface{}) {
	Logger.Printf(format, a...)
}

func Fatalf(format string, a ...interface{}) {
	Logger.Fatalf(format, a...)
}
