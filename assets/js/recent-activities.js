import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://sfegijeyprgxqfkehnqa.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmZWdpamV5cHJneHFma2VobnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3MjE5MDAsImV4cCI6MjA1NzI5NzkwMH0.NLxgYcZ-d6lTZRWf7DQ6pOmjUhsESjO8AEAZV0Vk4CI";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function initRecentActivities() {
  const container = document.getElementById("activityList");
 
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.error("Session error:", sessionError);
  }

  const user = sessionData?.session?.user;
  if (!user) {
    container.innerHTML = "<p>Please log in to view activity logs.</p>";
    return;
  }

  const { data: logs, error } = await supabase
    .from("activity_log")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(25);

  if (!logs || logs.length === 0) {
    container.innerHTML = "<p>No recent activity found.</p>";
    return;
  }

  logs.forEach((log) => {
    const div = document.createElement("div");
    div.className = "activity-item";
    div.innerHTML = `
      <div class="activity-description">${log.description || "No description"}</div>
      <div class="activity-time">${new Date(log.created_at).toLocaleString()}</div>
    `;
    container.appendChild(div);
  });
}