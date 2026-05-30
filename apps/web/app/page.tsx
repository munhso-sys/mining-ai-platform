import { supabase } from "../lib/supabase";

export default async function Home() {
  const { data } = await supabase
    .from("organizations")
    .select("*");

  return (
    <main className="p-10">
      <h1 className="text-4xl font-bold">
        Mining AI Platform
      </h1>

      <pre className="mt-6">
        {JSON.stringify(data, null, 2)}
      </pre>
    </main>
  );
}