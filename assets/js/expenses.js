import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://sfegijeyprgxqfkehnqa.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmZWdpamV5cHJneHFma2VobnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3MjE5MDAsImV4cCI6MjA1NzI5NzkwMH0.NLxgYcZ-d6lTZRWf7DQ6pOmjUhsESjO8AEAZV0Vk4CI";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function initAddExpensePage() {
  const groupSelect = document.getElementById("groupSelect");
  const paidBySelect = document.getElementById("paidBySelect");
  const categorySelect = document.getElementById("categorySelect");
  const descriptionInput = document.getElementById("descriptionInput");
  const amountInput = document.getElementById("amountInput");
  const splitTypeSelect = document.getElementById("splitTypeSelect");
  const expenseForm = document.getElementById("expenseForm");
  const expenseStatus = document.getElementById("expenseStatus");

  const splitContainer = document.createElement("div");
  splitContainer.id = "splitInputs";
  expenseForm.insertBefore(splitContainer, expenseForm.querySelector("button"));

  const session = await supabase.auth.getSession();
  const user = session?.data?.session?.user;

  if (!user) return;

  const { data: groups, error: groupError } = await supabase
  .from("group_member")
  .select("group_id, group!inner(name)")
  .eq("user_id", user.id)
  .eq("is_removed", false)
  .eq("group.is_active", true);
  
  if (groupError) return console.error("Group fetch error:", groupError.message);

  groupSelect.innerHTML = `<option value="">Select Group</option>`;
  
groups.forEach(({ group_id, group }) => {
  const opt = document.createElement("option");
  opt.value = group_id;
  opt.textContent = group.name;
  groupSelect.appendChild(opt);
});

  let members = [];

  groupSelect.addEventListener("change", async () => {
    paidBySelect.innerHTML = `<option value="">Select Member</option>`;
    splitContainer.innerHTML = "";
    const groupId = groupSelect.value;
    if (!groupId) return;

    const { data, error } = await supabase
      .from("group_member")
      .select("id, nickname")
      .eq("group_id", groupId);

    if (error) return console.error("Error fetching members:", error.message);
    members = data;

    members.forEach((member) => {
      const opt = document.createElement("option");
      opt.value = member.id;
      opt.textContent = member.nickname;
      paidBySelect.appendChild(opt);
    });
  });

  const categories = ["Trip", "Food", "Transport", "Gaming", "Study", "Office", "Household", "Other"];
categorySelect.innerHTML = `<option value="">Select Category</option>`;
categories.forEach((cat) => {
  const opt = document.createElement("option");
  opt.value = cat;
  opt.textContent = cat;
  categorySelect.appendChild(opt);
});

  splitTypeSelect.addEventListener("change", () => {
    const type = splitTypeSelect.value;
    const totalAmount = parseFloat(amountInput.value);
    splitContainer.innerHTML = "";

    members.forEach((member) => {
      const wrapper = document.createElement("div");
      wrapper.className = "split-row";

      const label = document.createElement("label");
      label.textContent = member.nickname;
      label.style.flex = "1";

      const input = document.createElement("input");
      input.type = "number";
      input.name = "split";
      input.setAttribute("data-member-id", member.id);
      input.placeholder = type === "percentage" ? "%" : "Amount";
      input.style.flex = "2";

      if (type === "equal" && !isNaN(totalAmount)) {
        input.disabled = true;
        input.value = (totalAmount / members.length).toFixed(2);
      }

      wrapper.appendChild(label);
      wrapper.appendChild(input);
      splitContainer.appendChild(wrapper);
    });
  });


expenseForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const groupId = groupSelect.value;
  const paidBy = paidBySelect.value;
  const category = categorySelect.value;
  const splitType = splitTypeSelect.value;
  const description = descriptionInput.value.trim();
  const amount = parseFloat(amountInput.value);

  if (!groupId || !paidBy || !splitType || isNaN(amount) || amount <= 0) {
    showStatus("Please fill in all required fields correctly.", false);
    return;
  }

  const splits = [];
  let totalSplitAmount = 0;
  let totalPercentage = 0;

  if (splitType === "equal") {
    const equalShare = amount / members.length;
    members.forEach((member) => {
      splits.push({
        exp_id: null,
        user_id: member.id,
        amount_owed: Math.round(equalShare),
        amount_paid: member.id === paidBy ? Math.round(amount) : 0,
        is_verified: false
      });
    });
  } else {
    document.querySelectorAll("#splitInputs input").forEach((input) => {
      const userId = input.getAttribute("data-member-id");
      const val = parseFloat(input.value);
      if (isNaN(val) || val < 0) return;

      let owed = 0;
      if (splitType === "by amount") {
        owed = val;
        totalSplitAmount += val;
      } else if (splitType === "percentage") {
        owed = (val / 100) * amount;
        totalPercentage += val;
      }

      splits.push({
        exp_id: null,
        user_id: userId,
        amount_owed: Math.round(owed),
        amount_paid: userId === paidBy ? Math.round(amount) : 0,
        is_verified: false
      });
    });

    if (splitType === "by amount" && Math.round(totalSplitAmount) !== Math.round(amount)) {
      showStatus(`Split total (${Math.round(totalSplitAmount)}) does not match expense amount (${Math.round(amount)}).`, false);
      return;
    }

    if (splitType === "percentage" && Math.round(totalPercentage) !== 100) {
      showStatus("Total percentage must equal 100%.", false);
      return;
    }
  }

  const { data: inserted, error } = await supabase.from("expense").insert({
    group_id: groupId,
    paid_by: paidBy,
    amount: Math.round(amount),
    split_type: splitType,
    is_verified: false,
    description,
    category,
  }).select().single();

  if (error || !inserted) {
    console.error("Insert error:", error);
    showStatus("Failed to add expense.", false);
    return;
  }

  const expenseId = inserted.id;
  splits.forEach((s) => (s.exp_id = expenseId));

  const { error: splitError } = await supabase.from("Expense_split").insert(splits);
  if (splitError) {
    console.error("Split insert error:", splitError.message);
    showStatus("Expense added, but split failed.", false);
  } else {
    await supabase.from("activity_log").insert({
      user_id: user.id,
      description: `Added expense: ₹${amount} in group '${groupSelect.options[groupSelect.selectedIndex].text}'`,
      type: "expense",
    });

    showStatus("Expense and split added successfully!", true);
    expenseForm.reset();
    splitContainer.innerHTML = "";
    
  }
  function showStatus(message, isSuccess) {
    const statusElement = document.getElementById("expenseStatus");
    statusElement.textContent = message;
    statusElement.style.color = isSuccess ? "green" : "red";
  }
});
}
