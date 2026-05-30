"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase-client";

export default function LoginPage() {
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");

  const login = async () => {
    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if(error){
      alert(error.message);
      return;
    }

    window.location.href="/dashboard";
  };

  return (
    <main className="p-10">
      <h1 className="text-3xl font-bold">
        Login
      </h1>

      <div className="mt-6 flex flex-col gap-4 max-w-md">
        <input
          className="border p-2"
          placeholder="Email"
          onChange={(e)=>setEmail(e.target.value)}
        />

        <input
          className="border p-2"
          type="password"
          placeholder="Password"
          onChange={(e)=>setPassword(e.target.value)}
        />

        <button
          className="border p-2"
          onClick={login}
        >
          Login
        </button>
      </div>
    </main>
  );
}