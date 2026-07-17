import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://sfegijeyprgxqfkehnqa.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmZWdpamV5cHJneHFma2VobnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3MjE5MDAsImV4cCI6MjA1NzI5NzkwMH0.NLxgYcZ-d6lTZRWf7DQ6pOmjUhsESjO8AEAZV0Vk4CI";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function initReportsPage() {
  const { data: session } = await supabase.auth.getSession();
  const user = session?.session?.user;

  if (!user) {
    document.getElementById("content").innerHTML = "<p>Couldn't Export</p>";
    return;
  }
  
  const { data: groupMembers, error: groupError } = await supabase
    .from("group_member")
    .select("id")
    .eq("user_id", user.id);

  if (groupError || !groupMembers) {
    console.error("Error fetching group memberships:", groupError);
    return;
  }

  const groupMemberIds = groupMembers.map((member) => member.id);

  const { data: expenses, error: expenseError } = await supabase
  .from("Expense_split")
  .select("amount_owed, expense:exp_id (created_at)")
  .in("user_id", groupMemberIds);

  if (expenseError || !expenses) {
    console.error("Error fetching expenses:", expenseError);
    return;
  }

  const totalPaid = expenses.reduce((sum, e) => sum + e.amount_owed, 0);
  document.getElementById("totalAmount").textContent = `₹${totalPaid}`;

  const { data: settlementsPaid, error: settleError } = await supabase
    .from("settlement")
    .select("*")
    .in("from", groupMemberIds);

  const settled = (settlementsPaid || []).reduce((sum, s) => sum + s.amount, 0);
  document.getElementById("settledAmount").textContent = `₹${settled}`;

  const outstanding = Math.max(totalPaid - settled, 0);
  document.getElementById("outstandingAmount").textContent = `₹${outstanding}`;

  const monthlyTotals = Array(12).fill(0);

  expenses.forEach((exp) => {
    const date = new Date(exp.expense?.created_at);
    if (!isNaN(date)) {
      const month = date.getMonth();
      monthlyTotals[month] += exp.amount_owed || 0;
    }
});

const chartScript = document.createElement("script");
chartScript.src = "https://cdn.jsdelivr.net/npm/chart.js@2.9.3/dist/Chart.min.js";
chartScript.onload = () => {
  const ctx = document.getElementById("monthlyChart").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      datasets: [{
        label: "Total Expense",
        data: monthlyTotals,
        backgroundColor: "#4A90E2",
        borderRadius: 6
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        yAxes: [{
          ticks: {
            beginAtZero: true,
            callback: value => `₹${value}`
          }
        }]
      }
    }
  });
};
document.body.appendChild(chartScript);
}