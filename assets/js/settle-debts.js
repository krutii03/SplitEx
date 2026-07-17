import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://sfegijeyprgxqfkehnqa.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmZWdpamV5cHJneHFma2VobnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3MjE5MDAsImV4cCI6MjA1NzI5NzkwMH0.NLxgYcZ-d6lTZRWf7DQ6pOmjUhsESjO8AEAZV0Vk4CI";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

let currentButtonData = null; 
let currentUser  = null;
let popup = null;

export async function initSettleDebtsPage() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return;

  currentUser  = user;

  const container = document.getElementById("settleContainer");
  if (!container) return;
  container.innerHTML = "Loading...";

  const results = [];
  await calculateDebts(user, results);
  displayResults(container, results, user);

  const viewHistoryBtn = document.createElement("button");
  viewHistoryBtn.textContent = "View Settlement History";
  viewHistoryBtn.className = "view-history-btn";
  viewHistoryBtn.style.marginTop = "20px";
  container.appendChild(viewHistoryBtn);
  
  viewHistoryBtn.addEventListener("click", () => {
    loadSettlementHistory(container, user);
  });
}

async function calculateAmountOwed(owedSplits, payerId) {
  let total = 0;
  for (const split of owedSplits) {
    const { data: expense } = await supabase
  .from("expense")
  .select("paid_by, is_verified")
  .eq("id", split.exp_id)
  .eq("is_verified", true)
  .single();
    if (expense && expense.paid_by === payerId) {
      total += split.amount_owed;
    }
  }
  return total;
}

async function calculateDebts(user, results) {
  const { data: memberships } = await supabase
    .from("group_member")
    .select("id, group_id, nickname")
    .eq("user_id", user.id);

  if (!memberships?.length) return;

  for (const membership of memberships) {
    const groupId = membership.group_id;
    const memberId = membership.id;

    const { data: groupData } = await supabase
      .from("group")
      .select("name")
      .eq("id", groupId)
      .single();

    const groupName = groupData?.name || "Unknown Group";

    const { data: groupMembers } = await supabase
      .from("group_member")
      .select("id, nickname")
      .eq("group_id", groupId);

    for (const otherMember of groupMembers) {
      if (otherMember.id === memberId) continue;

    const otherId = otherMember.id;

  const { data: splitsYouOwe } = await supabase
  .from("Expense_split")
  .select("amount_owed, exp_id")
  .eq("user_id", memberId)
  .eq("amount_paid", 0);

  const { data: splitsTheyOwe } = await supabase
  .from("Expense_split")
  .select("amount_owed, exp_id")
  .eq("user_id", otherId)
  .eq("amount_paid", 0);

  const { data: verifiedExpenses } = await supabase
  .from("expense")
  .select("id")
  .eq("is_verified", true);

const verifiedExpIds = verifiedExpenses?.map(e => e.id) || [];

const filteredSplitsYouOwe = splitsYouOwe?.filter(s => verifiedExpIds.includes(s.exp_id)) || [];
const filteredSplitsTheyOwe = splitsTheyOwe?.filter(s => verifiedExpIds.includes(s.exp_id)) || [];
const youOwe = await calculateAmountOwed(filteredSplitsYouOwe, otherId);
const theyOwe = await calculateAmountOwed(filteredSplitsTheyOwe, memberId);

      const { data: settledYouToThem } = await supabase
        .from("settlement")
        .select("amount")
        .eq("from", memberId)
        .eq("to", otherId)
        .eq("group_id", groupId);

      const { data: settledThemToYou } = await supabase
        .from("settlement")
        .select("amount")
        .eq("from", otherId)
        .eq("to", memberId)
        .eq("group_id ", groupId);

      const settled1 = settledYouToThem?.reduce((sum, s) => sum + s.amount, 0) || 0;
      const settled2 = settledThemToYou?.reduce((sum, s) => sum + s.amount, 0) || 0;

      const netAmount = (youOwe - theyOwe) - (settled1 - settled2);

      if (Math.abs(netAmount) > 0) {
        results.push({
          otherMember,
          netAmount,
          groupName,
          groupId,
          from: memberId,
          to: otherId,
        });
      }
    }
  }
}

function displayResults(container, results, user) {
  container.innerHTML = "";
  const filtered = results.filter((r) => r.netAmount !== 0);
  if (filtered.length === 0) {
    container.innerHTML = "<p>You're all settled! 🎉</p>";
    return;
  }

  const table = document.createElement("table");
  table.className = "settle-table";

  const header = table.createTHead();
  const headerRow = header.insertRow();
  headerRow.innerHTML = `
    <th>Member</th>
    <th>Amount</th>
    <th>Group</th>
    <th>Settle</th>
  `;

  const body = table.createTBody();

  filtered.forEach(({ otherMember, netAmount, groupName, groupId, from, to }) => {
    const row = body.insertRow();

    if (netAmount > 0) {
      row.innerHTML = `
        <td>${otherMember.nickname}</td>
        <td style="color:#ef4444;">₹${netAmount}</td>
        <td>${groupName}</td>
        <td>
          <button class="settle-btn"
            data-from="${from}" 
            data-to="${to}" 
            data-group="${groupId}" 
            data-amount="${netAmount}" 
            data-groupname="${groupName}">
            Settle
          </button>
        </td>
      `;
    } else {
      row.innerHTML = `
        <td>${otherMember.nickname}</td>
        <td style="color:#4CAF50;">₹${-netAmount}</td>
        <td>${groupName}</td>
        <td>Owes You</td>
      `;
    }
  });

  container.appendChild(table);

  if (!document.querySelector("#settle-popup")) {
    const popupDiv = document.createElement("div");
    popupDiv.id = "settle-popup";
    popupDiv.style.display = "none";
    popupDiv.innerHTML = `
      <div class="popup-overlay"></div>
      <div class="popup-box" style="text-align:center;">
        <p id="popup-message">How would you like to settle?</p>
        <button id="pay-cash">Settle</button>
        <button id="pay-online">Pay Online</button>
        <button id="popup-close">Cancel</button>
      </div>
    `;
    document.body.appendChild(popupDiv);
  }

   popup = document.querySelector("#settle-popup");
  const payCashBtn = popup.querySelector("#pay-cash");
  const payOnlineBtn = popup.querySelector("#pay-online");
  const closeBtn = popup.querySelector("#popup-close");

  container.querySelectorAll(".settle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentButtonData = btn;
      popup.style.display = "flex";
    });
  });

  closeBtn.onclick = () => {
    popup.style.display = "none";
    currentButtonData = null;
  };

  payCashBtn.onclick = async () => {
    if (!currentButtonData) return;
    const buttonData = currentButtonData;
    popup.style.display = "none";
  
    await pay(buttonData);
  
    currentButtonData = null;
  };

  payOnlineBtn.onclick = async () => {
    if (!currentButtonData) return;
  
    const from = currentButtonData.getAttribute("data-from");
    const to = currentButtonData.getAttribute("data-to");
    const amount = parseInt(currentButtonData.getAttribute("data-amount"));
    const groupName = currentButtonData.getAttribute("data-groupname");
  
    const { data: memberData, error: memberErr } = await supabase
      .from("group_member")
      .select("user_id")
      .eq("id", to)
      .single();
  
    if (memberErr || !memberData) {
      alert("Could not find user info for recipient.");
      console.error(memberErr);
      return;
    }
  
    const { data: userData, error: userErr } = await supabase
      .from("users")
      .select("upi")
      .eq("id", memberData.user_id)
      .single();
  
    if (userErr || !userData?.upi) {
      alert("Recipient has no UPI ID set.");
      console.error(userErr);
      return;
    }
  
    const upiId = userData.upi;
    const receiverName = groupName;
  
    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(receiverName)}&am=${amount}&cu=INR`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(upiUrl)}&size=200x200`;
  
    const existingModal = document.getElementById("qrModal");
    if (existingModal) existingModal.remove();

    const qrPopup = document.createElement("div");
    qrPopup.innerHTML = `
    <div id="qrModal" style="
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    ">
      <div style="
        background: white;
        padding: 20px;
        border-radius: 10px;
        text-align: center;
        font-family: 'Segoe UI', sans-serif;
      ">
        <h3 style="margin-bottom: 10px;">UPI Payment</h3>
        <p style="margin-bottom: 15px;">Pay ₹${amount} to ${receiverName}</p>
        <img src="${qrUrl}" alt="UPI QR Code" style="width: 200px; border-radius: 12px; margin: 10px 0;" />
        <div style="margin-top: 15px;">
          <button id="qr-paid" style="
            margin-right: 10px;
            padding: 8px 16px;
            background-color: #1a73e8;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
          ">Paid</button>
          <button id="qr-close" style="
            padding: 8px 16px;
            background-color: #f87171;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
          ">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
    document.body.appendChild(qrPopup);
  
    document.getElementById("qr-paid").onclick = async () => {
      const buttonData = currentButtonData;
      document.getElementById("qrModal")?.remove();
      await pay(buttonData);
      popup.style.display = "none";
      currentButtonData = null;
    };
    
    document.getElementById("qr-close").onclick = () => {
      document.getElementById("qrModal")?.remove();
      if (popup) popup.style.display = "none";
      currentButtonData = null; // ✅ Safe here
    };
  
    if (popup) popup.style.display = "none";
  
  };
}

async function pay(buttonData) {
  const fromGroupMemberId = buttonData.getAttribute("data-from");
  const toGroupMemberId = buttonData.getAttribute("data-to");
  const groupId = buttonData.getAttribute("data-group");
  const amount = parseInt(buttonData.getAttribute("data-amount"));
  const groupName = buttonData.getAttribute("data-groupname");



  const { error: insertError } = await supabase.from("settlement").insert({
    from: fromGroupMemberId,
    to: toGroupMemberId,
    amount,
    group_id: groupId,
  });

  if (insertError) {
    const modal = document.createElement("div");
        modal.innerHTML = `
          <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 20px; border-radius: 10px; text-align: center;">
              <h3>❗ Settlement Failed</h3>
              <p>${insertError}</p>
              <button id="modal-close-btn" style="padding: 8px 16px; background-color: #ef4444; color: white; border: none; border-radius: 6px;">OK</button>
            </div>
          </div>`;
        document.body.appendChild(modal);
        document.getElementById("modal-close-btn").onclick = () => modal.remove();
    popup.style.display = "none";
    currentButtonData = null;
    return;
  }

  await supabase.from("activity_log").insert({
    user_id: currentUser .id,
    description: `Settled ₹${amount} with a member in group '${groupName}'`,
    type: "settlement",
  });

  const { data: expenseIdsData } = await supabase
    .from("expense")
    .select("id")
    .eq("paid_by", toGroupMemberId)
    .eq("group_id", groupId);

  const relevantExpIds = expenseIdsData?.map(e => e.id) || [];

  if (relevantExpIds.length > 0) {
    const { data: allSplits } = await supabase
 .from("Expense_split")
      .select("id")
      .eq("user_id", fromGroupMemberId)
      .eq("is_settled", false)
      .in("exp_id", relevantExpIds);

    if (allSplits?.length) {
      const updates = allSplits.map(s =>
        supabase.from("Expense_split").update({
          is_settled: true,
          settled_at: new Date().toISOString(),
        }).eq("id", s.id)
      );
      await Promise.all(updates);
    }
  }

  const { data: allExpenseSplits } = await supabase
    .from("Expense_split")
    .select("id, user_id, is_settled")
    .in("exp_id", relevantExpIds);

  const allOthersSettled = allExpenseSplits
    .filter(s => s.user_id !== toGroupMemberId)
    .every(s => s.is_settled === true);

  if (allOthersSettled) {
    await supabase
      .from("Expense_split")
      .update({
        is_settled: true,
        settled_at: new Date().toISOString(),
      })
      .eq("exp_id", relevantExpIds[0])
      .eq("user_id", toGroupMemberId);

    await supabase
      .from("expense")
      .update({ is_settled: true })
      .eq("id", relevantExpIds[0]);
  }

  buttonData.parentElement.innerHTML = `<span style="color:green;">Settled successfully!</span>`;
  popup.style.display = "none";
currentButtonData = null;
}

async function loadSettlementHistory(container, user) {
  const { data: memberships } = await supabase
    .from("group_member")
    .select("id, nickname, group_id")
    .eq("user_id", user.id);

  if (!memberships?.length) {
    alert("No group memberships found.");
    return;
  }

  const memberIds = memberships.map((m) => m.id);
  const groupIds = [...new Set(memberships.map((m) => m.group_id))];

  const { data: settlements } = await supabase
    .from("settlement")
    .select("*")
    .in("group_id", groupIds)
    .order("created_at", { ascending: false });

  if (!settlements?.length) {
    alert("No settlement history found.");
    return;
  }

  const { data: allMembers } = await supabase
    .from("group_member")
    .select("id, nickname")
    .in("group_id", groupIds);

  const memberMap = Object.fromEntries(allMembers.map((m) => [m.id, m.nickname]));

  const { data: groups } = await supabase.from("group").select("id, name");
  const groupMap = Object.fromEntries(groups.map((g) => [g.id, g.name]));

  container.innerHTML = "<h3>Settlement History</h3>";
  const historyTable = document.createElement("table");
  historyTable.className = "settle-table";

  const header = historyTable.createTHead();
  header.innerHTML = `
    <tr>
      <th>From</th>
      <th>To</th>
      <th>Amount</th>
      <th>Group</th>
      <th>Date</th>
    </tr>
  `;

  const body = historyTable.createTBody();
  for (const entry of settlements) {
    const row = body.insertRow();
    const fromName = memberMap[entry.from] || "Unknown";
    const toName = memberMap[entry.to] || "Unknown";
    const groupName = groupMap[entry.group_id] || "Unknown";
    const date = new Date(entry.created_at).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    row.innerHTML = `
      <td>${fromName}</td>
      <td>${toName}</td>
      <td>₹${entry.amount}</td>
      <td>${groupName}</td>
      <td>${date}</td>
    `;
  }

  container.appendChild(historyTable);

  const backBtn = document.createElement("button");
  backBtn.id = "back";
  backBtn.textContent = "← Back to Settle Debts";
  backBtn.style.marginTop = "20px";
  backBtn.onclick = () => initSettleDebtsPage();
  container.appendChild(backBtn);
}