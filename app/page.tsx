const FIX_BRANCH = "https://github.com/pgdogdev/helm/pull/163";
const ISSUE = "https://github.com/pgdogdev/helm/issues/121";
const CHART = "https://github.com/pgdogdev/helm";
const DEMO_REPO = "https://github.com/cherylaurelia/pgdog-demo";

type Tone = "cmd" | "out" | "good" | "bad" | "note";

type Line = { tone: Tone; text: string };

const toneClass: Record<Tone, string> = {
  cmd: "text-accent-strong",
  out: "text-soft",
  good: "text-good",
  bad: "text-bad",
  note: "text-muted italic",
};

// Lines copied from the recorded kind runs (data/before.log and data/after.log in this repo).
const before: Line[] = [
  { tone: "cmd", text: "$ helm upgrade pgdog pgdogdev/pgdog -f bad.yaml   # host: postgres-primary (typo)" },
  { tone: "cmd", text: "$ kubectl rollout restart deploy/pgdog" },
  { tone: "out", text: "Waiting for deployment \"pgdog\" rollout to finish: 1 out of 2 new replicas have been updated..." },
  { tone: "note", text: "(5 more Waiting lines)" },
  { tone: "bad", text: "deployment \"pgdog\" successfully rolled out        # 05:21:55 → 05:21:57" },
  { tone: "cmd", text: "$ kubectl get pods" },
  { tone: "out", text: "pgdog-5d864f4bc5-5885d   0/1   Completed     0   24s" },
  { tone: "out", text: "pgdog-5d864f4bc5-srgkk   1/1   Terminating   0   24s" },
  { tone: "bad", text: "pgdog-8884db45c-54jmp    1/1   Running       0   1s" },
  { tone: "bad", text: "pgdog-8884db45c-cmkz7    1/1   Running       0   2s" },
  { tone: "cmd", text: "$ psql -h pgdog -p 6432 -U postgres -d app -c 'select 1'   # 3 tries" },
  { tone: "bad", text: "ERROR:  connection pool for user \"postgres\" and database \"app\" is down" },
  { tone: "bad", text: "ERROR:  connection pool for user \"postgres\" and database \"app\" is down" },
  { tone: "bad", text: "ERROR:  connection pool for user \"postgres\" and database \"app\" is down" },
];

const after: Line[] = [
  { tone: "cmd", text: "$ helm upgrade pgdog ./helm -f bad.yaml   # same typo, chart with the fix" },
  { tone: "cmd", text: "$ kubectl rollout restart deploy/pgdog" },
  { tone: "good", text: "error: timed out waiting for the condition        # rollout stopped" },
  { tone: "cmd", text: "$ kubectl get pods" },
  { tone: "good", text: "pgdog-5f7984bd86-vzpcn   0/1   Running   0   45s   # new pod, readiness 502" },
  { tone: "out", text: "pgdog-86b8f4f5fd-4zlqn   1/1   Running   0   67s   # old pods keep serving" },
  { tone: "out", text: "pgdog-86b8f4f5fd-mfgh4   1/1   Running   0   56s" },
  { tone: "cmd", text: "$ psql -h pgdog -p 6432 -U postgres -d app -c 'select 1'   # 3 tries" },
  { tone: "good", text: "1" },
  { tone: "good", text: "1" },
  { tone: "good", text: "1" },
  { tone: "note", text: "Same result on 3 of 3 runs, and with an unreachable IP instead of a typo." },
];

const diff: Line[] = [
  { tone: "note", text: "# values.yaml" },
  { tone: "bad", text: "-# healthcheckPort: 8080" },
  { tone: "good", text: "+healthcheckPort: 8080" },
  { tone: "note", text: "# templates/deployment.yaml (container ports)" },
  { tone: "good", text: "+            {{- if .Values.healthcheckPort }}" },
  { tone: "good", text: "+            - name: healthcheck" },
  { tone: "good", text: "+              containerPort: {{ .Values.healthcheckPort }}" },
  { tone: "good", text: "+            {{- end }}" },
  { tone: "note", text: "# templates/deployment.yaml (probes)" },
  { tone: "out", text: "           {{- if .Values.readinessProbe }}" },
  { tone: "out", text: "           readinessProbe:" },
  { tone: "out", text: "             {{- toYaml .Values.readinessProbe | nindent 12 }}" },
  { tone: "good", text: "+          {{- else if .Values.healthcheckPort }}" },
  { tone: "good", text: "+          readinessProbe:" },
  { tone: "good", text: "+            initialDelaySeconds: 10" },
  { tone: "good", text: "+            httpGet:" },
  { tone: "good", text: "+              path: /" },
  { tone: "good", text: "+              port: healthcheck" },
  { tone: "out", text: "           {{- end }}" },
];

const checks: { title: string; body: string }[] = [
  {
    title: "One database down of two",
    body: "The endpoint only returns 502 when every pool is down, so the pod stays ready and the healthy database keeps serving.",
  },
  {
    title: "Postgres outage",
    body: "With Postgres scaled to 0 for 45 s, every pod went NotReady. About 20 s after Postgres came back they were Ready again, with no client traffic.",
  },
  {
    title: "Why the 10 s delay",
    body: "Pools start out healthy until their first connect fails (up to connect_timeout, 5 s), so the probe waits 10 s. Starting pools as unknown in pgdog would remove the need.",
  },
  {
    title: "Readiness only",
    body: "There's no liveness probe on this endpoint, because restarting PgDog during a database outage would drop every client and wouldn't help.",
  },
  {
    title: "Upgrade change",
    body: "Installs without a readinessProbe get healthcheck_port = 8080 and the probe. A user-set probe is kept, and healthcheckPort: null turns it off. With service.aws.enabled, the NLB switches to its HTTP check (not tested on EKS).",
  },
  {
    title: "Their CI, locally",
    body: "test/test.sh passes on all 34 values files, plus a new check that fails if either the template or the values change is reverted.",
  },
];

function Terminal({ title, lines, label }: { title: string; lines: Line[]; label: string }) {
  return (
    <figure className="min-w-0 rounded-lg border border-line bg-term">
      <figcaption className="flex items-center justify-between border-b border-line px-4 py-2 text-xs text-muted">
        <span>{title}</span>
        <span>{label}</span>
      </figcaption>
      <pre className="overflow-x-auto p-4 text-[12.5px] leading-relaxed">
        {lines.map((line, index) => (
          <div key={`${title}-${index}`} className={toneClass[line.tone]}>
            {line.text}
          </div>
        ))}
      </pre>
    </figure>
  );
}

function LinkButton({ href, children, primary }: { href: string; children: string; primary?: boolean }) {
  const look = primary
    ? "bg-accent text-term hover:bg-accent-strong"
    : "border border-line text-text hover:border-accent";

  return (
    <a href={href} className={`rounded-md px-4 py-2 text-sm font-semibold ${look}`}>
      {children}
    </a>
  );
}

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
      <p className="text-xs uppercase tracking-widest text-accent">pgdogdev/helm · issue #121</p>
      <h1 className="mt-4 max-w-4xl text-2xl font-bold leading-snug sm:text-3xl">
        A bad config rolls out to every PgDog pod, because the Helm chart has no readiness probe.
      </h1>
      <p className="mt-4 max-w-3xl text-soft">
        A default readiness probe on PgDog&apos;s own healthcheck endpoint stops the rollout at the first broken pod,
        and the old pods keep serving. This is the approach Lev suggested in #121, recorded on a kind cluster.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        <LinkButton href={FIX_BRANCH} primary>
          PR #163
        </LinkButton>
        <LinkButton href={ISSUE}>Issue #121</LinkButton>
        <LinkButton href={CHART}>pgdogdev/helm</LinkButton>
      </div>

      <section className="mt-12" aria-labelledby="runs">
        <h2 id="runs" className="text-lg font-bold">
          Same typo, two charts
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-soft">
          2 replicas, the chart&apos;s default values, Postgres 18 in the cluster. The values change has a typo in the
          database host. <code className="text-accent-strong">rollout restart</code> is how a config change reaches pods,
          since PgDog reloads most settings in place and the chart doesn&apos;t roll pods for a ConfigMap change.
        </p>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Terminal title="Before: chart main (v0.95)" label="both pods replaced in 2 s" lines={before} />
          <Terminal title="After: default readiness probe" label="rollout stops at pod 1" lines={after} />
        </div>
      </section>

      <section className="mt-12" aria-labelledby="change">
        <h2 id="change" className="text-lg font-bold">
          The change
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-soft">
          Three files, +38/−4 including a test. The probe is added only when you haven&apos;t set your own.
        </p>
        <div className="mt-5">
          <Terminal title="diff (trimmed to the template lines)" label="fix/default-readiness-probe" lines={diff} />
        </div>
      </section>

      <section className="mt-12" aria-labelledby="checked">
        <h2 id="checked" className="text-lg font-bold">
          What else was checked
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {checks.map((check) => (
            <li key={check.title} className="rounded-lg border border-line bg-panel p-4">
              <h3 className="text-sm font-bold text-accent-strong">{check.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-soft">{check.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 max-w-3xl text-sm text-soft" aria-labelledby="rerun">
        <h2 id="rerun" className="text-lg font-bold text-text">
          Rerun it
        </h2>
        <p className="mt-2">
          The values files, Postgres manifest and logs are in{" "}
          <a className="text-accent underline" href={DEMO_REPO}>
            the demo repo
          </a>
          . With kind and helm installed: create a cluster, apply <code>pg.yaml</code>, install the chart with{" "}
          <code>good.yaml</code>, then upgrade with <code>bad.yaml</code> and run{" "}
          <code>kubectl rollout restart deploy/pgdog</code>.
        </p>
      </section>

      <footer className="mt-16 border-t border-line pt-6 text-xs text-muted">
        Unofficial demo by Cheryl Aurelia: not affiliated with PgDog. Recorded 2026-11-08 with
        ghcr.io/pgdogdev/pgdog:v0.1.63 and chart main d93d344.
      </footer>
    </main>
  );
}
