import { api } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { Badge, Card, CardHeader, Skeleton } from "../components/ui/primitives";

export default function Settings() {
  const { data, loading } = useFetch(() => api.providers(), []);

  return (
    <div className="max-w-lg space-y-5">
      <h1 className="text-xl font-semibold">Settings</h1>
      <Card>
        <CardHeader title="PROVIDERS" subtitle="Configured in your local .env file — never entered or shown here" />
        {loading ? (
          <div className="px-5 pb-4"><Skeleton className="h-10" /></div>
        ) : (
          <div className="px-5 pb-4 space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span>Gemini</span>
              <Badge tone={data?.gemini ? "success" : "neutral"}>{data?.gemini ? "Configured" : "Not set"}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Claude</span>
              <Badge tone={data?.claude ? "success" : "neutral"}>{data?.claude ? "Configured" : "Not set"}</Badge>
            </div>
          </div>
        )}
      </Card>
      <Card>
        <CardHeader title="ABOUT" />
        <div className="px-5 pb-4 text-xs text-muted space-y-1">
          <p>This dashboard runs on your machine only (127.0.0.1) and never exposes results to the network.</p>
          <p>It finds known weaknesses only — it cannot prove an assistant is safe.</p>
        </div>
      </Card>
    </div>
  );
}
