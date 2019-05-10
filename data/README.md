# Databases

The `/data` directory contains code that interacts with the database, so I figured
this would be a logical place to explain the common things you do with the
database.

# Overview

We are using Postgres 10.2. There are several types of databases this code uses:

* Test databases are used by unit tests. These are named `test0`, `test1`, etc.

* Local databases are used when you run a cluster locally. These are named `local0`, `local1`, etc.

* The production database is used by a machine that is running a multi-machine setup.

# Setup

To create the test and local databases you will need to run the one-time setup script:

```
cd ~/go/src/axiom-org/axiom
./create-databases.sh
```

If you want to clear the local databases to restart their blockchain:

```
./clear-local.sh
```

The unit tests will clear the test databases by themselves.

# Benchmarking

To run the query benchmarks:

```
go test ./data -run=zzz -bench=BenchmarkOneConstraint -benchtime=60s

go test ./data -run=zzz -bench=BenchmarkTwoConstraints -benchtime=60s
```

It will take some number of minutes, so be patient.

The performance of the two is about the same time on my Macbook, 35 ms per op.

TODO: is that ridiculously bad, such that I must be missing something?

# Maintenance

TODO: write some tips for miners on how to keep their databases well-maintained