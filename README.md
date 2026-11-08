# PgDog Helm chart: a readiness probe by default

Unofficial demo by Cheryl Aurelia, not affiliated with PgDog.

**Problem.** The [PgDog Helm chart](https://github.com/pgdogdev/helm) renders no readiness probe and no
`healthcheck_port` by default. Kubernetes can't tell a PgDog pod whose pools are all down from a working one,
so a values change with a bad database setting plus `kubectl rollout restart` replaces every pod with a broken
one. Users asked for default probes in [pgdogdev/helm#121](https://github.com/pgdogdev/helm/issues/121), and the
maintainer suggested defaulting `healthcheck_port` to 8080 and using it for the probe.

**Fix.** Branch [`fix/default-readiness-probe`](https://github.com/cherylaurelia/helm/tree/fix/default-readiness-probe):
`healthcheckPort: 8080` by default, a `healthcheck` container port, and an HTTP readiness probe with a 10 s
initial delay when the user hasn't set `readinessProbe`. `healthcheckPort: null` turns it off.

**Evidence** (kind, 2 replicas, Postgres 18, ghcr.io/pgdogdev/pgdog:v0.1.63, chart main d93d344), in `data/`:
- `before.log`: chart main, host typo, rollout finished in 2 s, every query `connection pool ... is down`.
- `after.log`: with the fix, 3 of 3 typo runs and an unreachable-IP run stopped at the first pod while the old pods served.
- `multi.log`: one of two databases unreachable, pods stay Ready.
- `outage.log`: Postgres down 45 s, pods NotReady, Ready again ~20 s after it returns.

## Rerun

```sh
kind create cluster
kubectl apply -f data/pg.yaml
helm install pgdog <chart> -f data/good.yaml
helm upgrade pgdog <chart> -f data/bad.yaml && kubectl rollout restart deploy/pgdog
kubectl rollout status deploy/pgdog
```

## Page

Next.js + Tailwind, one static page: `npm install && npm run build && npm start`.
