import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://sfegijeyprgxqfkehnqa.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmZWdpamV5cHJneHFma2VobnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3MjE5MDAsImV4cCI6MjA1NzI5NzkwMH0.NLxgYcZ-d6lTZRWf7DQ6pOmjUhsESjO8AEAZV0Vk4CI";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function getCurrentUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    alert("Session expired. Please log in.");
    window.location.href = "/login.html";
  }
  return user.id;
}

export async function initSettingsPage() {
  console.log("Settings page initialized!");

  const changePasswordBtn = document.getElementById("changePasswordBtn");
  const deactivateBtn = document.getElementById("deactivateBtn");
  const exportDataBtn = document.getElementById("exportDataBtn");
  const clearLogsBtn = document.getElementById("clearLogsBtn");

  if (changePasswordBtn) {
    changePasswordBtn.addEventListener("click", injectPasswordField);
  }
  if (deactivateBtn) {
    deactivateBtn.addEventListener("click", deactivateAccount);
  }
  if (exportDataBtn) {
    exportDataBtn.addEventListener("click", exportUserData);
  }
  if (clearLogsBtn) {
    clearLogsBtn.addEventListener("click", clearActivityLogs);
  }
  const updateUpiBtn = document.getElementById("updateUpiBtn"); 
if (updateUpiBtn) {
  updateUpiBtn.addEventListener("click", injectUpiField);
}
}

async function changePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    alert("Error: " + error.message);
  } else {
    alert("Password updated successfully!");
  }
}

async function deactivateAccount() {
  const confirmDeactivate = confirm("Are you sure you want to deactivate?");
  if (!confirmDeactivate) return;

  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from("users")
    .update({ is_active: false })
    .eq("id", userId);

  if (error) {
    alert("Error: " + error.message);
  } else {
    alert("Account deactivated.");
    await supabase.auth.signOut();
    window.location.href = "/login.html";
  }
}

async function exportUserData() {
  const userId = await getCurrentUserId();

  if (!window.jspdf) {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    document.head.appendChild(script);
    await new Promise((resolve) => script.onload = resolve);
  }

  if (!window.jspdfAutoTable) {
    const autoTableScript = document.createElement("script");
    autoTableScript.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js";
    document.head.appendChild(autoTableScript);
    await new Promise((resolve) => autoTableScript.onload = resolve);
  }

  const { jsPDF } = window.jspdf || {};
  const doc = new jsPDF();

  const [activityLog, expenses, settlements] = await Promise.all([
    supabase.from("activity_log").select("*").eq("user_id", userId),
    supabase.from("expense").select("*").in("paid_by", await getUserGroupMemberIds(userId)),
    supabase.from("settlement").select("*").or(`from.eq.${userId},to.eq.${userId}`)
  ]);

  const groupMemberIds = [
    ...new Set([
      ...expenses.data.map(exp => exp.paid_by),
      ...settlements.data.map(s => s.from),
      ...settlements.data.map(s => s.to)
    ])
  ];

  const groupMembers = await supabase
    .from("group_member")
    .select("user_id, id")
    .in("id", groupMemberIds);

  const users = await supabase
    .from("users")
    .select("id, name");

  const userNameMap = {};
  groupMembers.data.forEach(member => {
    const user = users.data.find(u => u.id === member.user_id);
    if (user) {
      userNameMap[member.id] = user.name;
    }
  });

  let y = 20;
  doc.setFontSize(16);
  doc.text("SplitEx User Report", 14, y);
  y += 10;

  if (expenses.data?.length) {
    doc.setFontSize(14);
    doc.text("Expenses", 14, y);
    y += 4;
    doc.autoTable({
      startY: y,
      head: [["Description", "Amount", "Paid By", "Verified", "Date"]],
      body: expenses.data.map(exp => [
        exp.description,
        `${exp.amount}`,
        userNameMap[exp.paid_by] || "Unknown", 
        exp.is_verified ? "Yes" : "No",
        new Date(exp.created_at).toLocaleDateString()
      ]),
    });
    y = doc.autoTable.previous.finalY + 10;
  }

  if (settlements.data?.length) {
    doc.setFontSize(14);
    doc.text("Settlements", 14, y);
    y += 4;
    doc.autoTable({
      startY: y,
      head: [["From", "To", "Amount", "Date"]],
      body: settlements.data.map(s => [
        userNameMap[s.from] || "Unknown", 
        userNameMap[s.to] || "Unknown",  
        `${s.amount}`,
        new Date(s.created_at).toLocaleDateString()
      ]),
    });
    y = doc.autoTable.previous.finalY + 10;
  }

  if (activityLog.data?.length) {
    doc.setFontSize(14);
    doc.text("Activity Log", 14, y);
    y += 4;
    doc.autoTable({
      startY: y,
      head: [["Type", "Description", "Date"]],
      body: activityLog.data.map(log => [
        log.type,
        log.description,
        new Date(log.created_at).toLocaleString()
      ]),
    });
  }

  doc.save("splitex_user_data.pdf");
}

async function getUserGroupMemberIds(userId) {
  const { data, error } = await supabase
    .from("group_member")
    .select("id")
    .eq("user_id", userId);

  return error || !data ? [] : data.map(m => m.id);
}

async function clearActivityLogs() {
  const confirmClear = confirm("Want to Delete all logs Permanently?");
  if (!confirmClear) return;

  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from("activity_log")
    .delete()
    .eq("user_id", userId);

  if (error) {
    alert("Error clearing logs.");
  } else {
    alert("Logs cleared.");
  }
}

function injectPasswordField() {
  const container = document.querySelector("#changePasswordBtn").parentElement;

  if (container.querySelector(".password-input")) return;

  const wrapper = document.createElement("div");
  wrapper.className = "password-wrapper";
  wrapper.style.display = "flex";
  wrapper.style.marginTop = "10px";
  wrapper.style.gap = "8px";
  wrapper.style.alignItems = "center";

  const input = document.createElement("input");
  input.type = "password";
  input.placeholder = "Enter new password";
  input.className = "password-input";
  input.style.flex = "1";
  input.style.padding = "8px";
  input.style.border = "1px solid #ccc";
  input.style.borderRadius = "6px";

  const confirmBtn = document.createElement("button");
  confirmBtn.innerText = "RESET PASSWORD";
  confirmBtn.className = "confirm-btn";
  confirmBtn.style.width = "120px";
  confirmBtn.style.padding = "8px 12px";
  confirmBtn.style.fontSize = "10px";
  confirmBtn.style.backgroundColor = "#4CAF50";

  confirmBtn.onclick = async () => {
    if (input.value.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }
    await changePassword(input.value);
    wrapper.remove();
  };

  wrapper.appendChild(input);
  wrapper.appendChild(confirmBtn);
  container.appendChild(wrapper);
}

async function injectUpiField() {
  const container = document.querySelector("#updateUpiBtn").parentElement;

  if (container.querySelector(".upi-input")) return;

  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("users")
    .select("upi")
    .eq("id", userId)
    .single();

  const wrapper = document.createElement("div");
  wrapper.className = "upi-wrapper";
  wrapper.style.display = "flex";
  wrapper.style.marginTop = "10px";
  wrapper.style.gap = "8px";
  wrapper.style.alignItems = "center";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "upi-input";
  input.style.flex = "1";
  input.style.padding = "8px";
  input.style.border = "1px solid #ccc";
  input.style.borderRadius = "6px";

  if (error || !data || !data.upi) {
    input.placeholder = "UPI ID not found";
  } else {
    input.placeholder = "Enter new UPI ID";
    input.value = data.upi;
  }

  const confirmBtn = document.createElement("button");
  confirmBtn.innerText = "UPDATE UPI";
  confirmBtn.className = "confirm-btn";
  confirmBtn.style.width = "120px";
  confirmBtn.style.padding = "8px 12px";
  confirmBtn.style.fontSize = "10px";
  confirmBtn.style.backgroundColor = "#4CAF50";

  confirmBtn.onclick = async () => {
    const newUpi = input.value.trim();
    if (!newUpi || !newUpi.includes("@")) {
      alert("Enter a valid UPI ID (like yourname@bank)");
      return;
    }

    const { error } = await supabase
      .from("users")
      .update({ upi: newUpi })
      .eq("id", userId);

    if (error) {
      alert("Error updating UPI ID.");
    } else {
      alert("UPI ID updated successfully.");
      wrapper.remove();
    }
  };

  wrapper.appendChild(input);
  wrapper.appendChild(confirmBtn);
  container.appendChild(wrapper);
}