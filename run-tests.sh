#!/bin/bash

print_help() {
    echo "--long to run the long test suite"
    exit
}

run_long() {
    AXIOM_LONG_TESTS=1 go test -timeout 120m ./...
    exit
}

run_normal() {
    AXIOM_LONG_TESTS=0 go test -timeout 120m ./...
    exit
}

while test $# -gt 0
do
    case "$1" in
        --long) run_long
            ;;
        --help) print_help
            ;;
        *) print_help
            ;;
    esac
    shift
done

run_normal

exit 0
