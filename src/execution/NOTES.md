Split Execution into two phases
===============================
This is an attempt to address optmization concerns during query evaluation.

This approach splits execution into two phases, a planning phase and an evaluation phase.

In the planning phase the AST in analyzed and a heirarchical plan structure is created indicating
how the executor will evaluate the query.  Precalculating this information serves two purposes:

1. Provides a reliable and simple indication to resolving functions what evaulations will occur next.
2. Avoids re-calculating some data when evaluating list results

There is no attempt to optimize the plan.  This is out of scope, although it would be possible to write
optimizing functions that accepted a plan and output a different plan before evaluation.

Evaluation order is not changed.
