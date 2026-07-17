import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";


const supabaseUrl = "https://sfegijeyprgxqfkehnqa.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmZWdpamV5cHJneHFma2VobnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3MjE5MDAsImV4cCI6MjA1NzI5NzkwMH0.NLxgYcZ-d6lTZRWf7DQ6pOmjUhsESjO8AEAZV0Vk4CI";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let barChartInstance, pieChartInstance, piechart;

document.addEventListener("DOMContentLoaded", async () => {
  const sidebarButtons = document.querySelectorAll(".sidebar .sidebar-button");
  const content = document.getElementById("adminContent");

  sidebarButtons.forEach((button) => {
    button.addEventListener("click", () => {
      sidebarButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      const section = button.id.replace("admin", "");
      loadContent(section);
    });
  });

  document.getElementById("profileBtn").addEventListener("click", () => {

    const modal = document.createElement("div");
    modal.innerHTML = `
      <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000;">
        <div style="background: white; padding: 20px 30px; border-radius: 12px; text-align: center; max-width: 300px;">
          <h3 style="margin-bottom: 10px;">🚪 Log Out</h3>
          <p style="margin-bottom: 20px;">Are you sure you want to log out?</p>
          <div style="display: flex; justify-content: center; gap: 12px;">
            <button id="logout-confirm" style="padding: 8px 16px; background-color: #ef4444; color: white; border: none; border-radius: 6px;">Yes</button>
            <button id="logout-cancel" style="padding: 8px 16px; background-color: #9ca3af; color: white; border: none; border-radius: 6px;">No</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  
    document.getElementById("logout-cancel").onclick = () => modal.remove();
  
    document.getElementById("logout-confirm").onclick = async () => {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Logout failed:", error.message);
      } else {
        window.location.replace("index.html");
      }
      modal.remove();
    };
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user) return;


async function loadContent(section) {
    switch (section) {
      case "UserManagement":
        content.innerHTML = `
          <h2>User Management</h2>
          <p id="userCount" class="user-count"></p>
          <input type="text" id="userSearch" placeholder="Search by name or email..." class="admin-search-input"/>
          <div id="userList" class="user-list">Loading users...</div>
        `;
        loadUsers();
        break;

      case "GroupManagement":
        content.innerHTML = `
          <h2>Group Management</h2>
          <input type="text" id="groupSearch" placeholder="Search groups..." class="group-search-input"/>
          <div id="groupList" class="group-list">Loading groups...</div>      
        `;
        loadGroups();
        break;

      case "ExpenseManagement":
        content.innerHTML = `
          <h2>Expense Management</h2>
          <input type="text" id="expenseSearch" placeholder="Filter by(Description, Username, Groupname, Date)"/>
          <div id="expenseList">Loading expenses...</div>
        `;
        loadExpenses();
        break;

        case "ActivityLog":
            content.innerHTML = `
              <h2>Activity Log</h2>
              <div>
                <label for="filterType">Filter by Category:</label>
                <select id="filterType">
                  <option value="">All Categories</option>
                </select>
              </div>
              <table id="activityLogTable">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>User</th>
                    <th>Type</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody></tbody>
              </table>
            `;
          
             populateActivityTypes(); 
             loadActivityLogs();
        
        
            document.getElementById("filterType").addEventListener("change", (event) => {
              loadActivityLogs(event.target.value);
            });
            break;

            
            case "StatsDashboard":
            content.innerHTML = `
            <h2 style="font-size:1.5rem;margin-bottom:20px;">Stats Dashboard</h2>
            <div class="stats-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 30px;">
            <div id="totalUsersCard"></div>
            <div id="totalGroupsCard"></div>
            <div id="totalExpensesCard"></div>
            <div id="totalSettlementsCard"></div>
            </div>

        <div class="charts">
  
  <div class="chartss">
    <div class="piechart1">
     <canvas id="expenseTypesPieChart" class="chart"></canvas>
    </div>
    <div class="piechart2">
     <canvas id="splitTypesPieChart" class="chart"></canvas>
    </div>
  </div>
  <div class="barchart" style="margin-bottom: 300px;">
    <canvas id="expensesBarChart" class="chart" ></canvas><br><br><br>
  </div>
</div>
  `;

  loadStats();
  fetchStatsData();
 
  break;

  case "Profile":
  content.innerHTML = `
    <link rel="stylesheet" href="../assets/css/adminprofile.css">
    <div class="profile-container">
      <h2>Admin Profile</h2>
      <!-- VIEW MODE -->
      <div class="profile-card" id="viewAdminProfile">
        <h4 id="adminProfileName"></h4>
        <div class="profile-info">
          <p>Email: <span id="adminProfileEmail"></span></p>
          <p>Created At: <span id="adminCreatedAt"></span></p>
        </div>
        <button id="editAdminBtn" class="btn">Edit Profile</button>
      </div>

      <!-- EDIT MODE -->
      <form id="editAdminSection" class="edit-profile-form" style="display: none;">
        <label for="adminName">Name</label>
        <input type="text" id="adminName" required /><br><br>
        <label for="adminEmail">Email</label>
        <input type="email" id="adminEmail" disabled /><br><br>
        <label for="adminPassword">Change Password</label>
        <input type="password" id="adminPassword" placeholder="New Password" /><br><br>
        <button type="submit" class="btn save-btn">Save Changes</button>
      </form>
    </div>

    <!-- ADD NEW ADMIN -->
    <div class="add-admin-container">
      <h3>Add New Admin</h3>
      <form id="addAdminForm">
        <label for="newAdminName">Name</label>
        <input type="text" id="newAdminName" placeholder="Admin Name" required />
        <label for="newAdminEmail">Email</label>
        <input type="email" id="newAdminEmail" placeholder="admin@example.com" required />
        <label for="newAdminPassword">Password</label>
        <input type="password" id="newAdminPassword" placeholder="Secure Password" required />
        <button type="submit" class="btn">Add Admin</button>
      </form>
    </div>
  `;

  setTimeout(() => {
    initAdminProfileLogic();
    const form = document.getElementById("addAdminForm");
    if (!form) {
      console.error("Add Admin form not found.");
      return;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("newAdminName").value.trim();
      const email = document.getElementById("newAdminEmail").value.trim();
      const password = document.getElementById("newAdminPassword").value.trim();

      if (!name || !email || !password) {
        alert("Please fill out all fields.");
        return;
      }

      await addAdmin(name, email, password);
      e.target.reset();
    });

  }, 0);

  break;


      default:
        
        await setWelcomeMessage();
        break;
    }
  }

  loadContent("");
});

// ----------------- LOAD USERS -----------------
async function loadUsers() {
  const userList = document.getElementById("userList");
  const searchInput = document.getElementById("userSearch");
  const userCount = document.getElementById("userCount");

  let { data: users, error } = await supabase.from("users").select("*");

  if (error) {
    userList.innerHTML = `<p class="error">Failed to load users</p>`;
    return;
  }

  function renderList(filter = "") {
    const filtered = users.filter(
      (user) =>
        user.name?.toLowerCase().includes(filter.toLowerCase()) ||
        user.email?.toLowerCase().includes(filter.toLowerCase())
    );

    userCount.innerText = `${filtered.length} user${filtered.length !== 1 ? "s" : ""}`;

    if (filtered.length === 0) {
      userList.innerHTML = `<div class="empty-state"><h3>NO USERS FOUND!</h3></div>`;
      return;
    }

    userList.innerHTML = filtered
      .map(
        (user) => `
        <div class="user-card">
          <img src="${user.photo || "../assets/img/profilelogo.jpg"}" alt="User" class="user-avatar"/>
          <div class="user-info">
            <h3>${user.name || "Unnamed"}</h3>
            <p>${user.email}</p>
            <p>Status: <strong>${user.is_active ? "Active" : "Banned"}</strong></p>
          </div>
          <button class="ban-btn" data-id="${user.id}" data-active="${user.is_active}">
            ${user.is_active ? "Ban" : "Unban"}
          </button>
        </div>
      `
      )
      .join("");

    document.querySelectorAll(".ban-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        const userId = button.getAttribute("data-id");
        const isActive = button.getAttribute("data-active") === "true";

        const confirmed = confirm(
          `Are you sure you want to ${isActive ? "ban" : "unban"} this user?`
        );
        if (!confirmed) return;

        const { error } = await supabase
          .from("users")
          .update({ is_active: !isActive })
          .eq("id", userId);

        if (!error) {
          users = users.map((u) =>
            u.id === userId ? { ...u, is_active: !isActive } : u
          );
          renderList(searchInput.value);
        }
      });
    });
  }

  searchInput.addEventListener("input", () =>
    renderList(searchInput.value)
  );

  renderList();
}

// ----------------- LOAD GROUPS -----------------
async function loadGroups() {
  const groupList = document.getElementById("groupList");
  const searchInput = document.getElementById("groupSearch");

  let { data: groups, error } = await supabase
  .from("group")
  .select(`
    *,
    users(name),
    group_member(
      is_admin,
      is_removed,
      users(name, photo)
    )
  `)
  .order("created_at", { ascending: false });

  if (error) {
    groupList.innerHTML = `<p class="error">Failed to load groups</p>`;
    return;
  }

  function renderGroups(filter = "") {
    const filtered = groups.filter((group) =>
      group.name?.toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) {
      groupList.innerHTML = `<div class="empty-group-state" style="width: 100%; margin-top: 150px; margin-left: 400px; text-align: center; font-size: 20px; color: #333;">No groups found!</div>`;
      return;
    }

    groupList.innerHTML = filtered
      .map((group) => {
        
        let membersHTML = "";
        if (group.group_member && group.group_member.length > 0) {
          membersHTML = `
            <div class="member-list" style="margin-top: 10px;">
              <p><strong>Members:</strong></p>
              <ul style="list-style: none; padding-left: 0;">
                ${group.group_member
                  .map((member) => `
                  <li style="display: flex; align-items: center; gap: 5px; margin-top: 6px;">
                    <img src="${member.users?.photo || '../assets/img/profilelogo.png'}" alt="${member.users?.name || "Unknown"}" style="width: 24px; height: 24px; border-radius: 50%;" />
                   <span>
  ${member.users?.name || "Unknown"}
  ${member.is_admin && member.is_removed ? " (ADMIN, INACTIVE)" 
    : member.is_admin ? " (ADMIN)" 
    : member.is_removed ? " (INACTIVE)" 
    : ""}
</span>
                  </li>
                `)
                  .join("")}
              </ul>
            </div>
          `;
        }

        return `
          <div class="group-card">
            <div class="group-info">
              <img src="${group.logo || "../assets/img/grouplogo.jpg"}" class="group-logo" />
              <div class="group-details">
                <h3>${group.name || "Unnamed Group"}</h3>
                <p>Created by: ${group.users?.name || "Unknown"}</p>
              </div>
            </div>
            <div class="group-extra-info">
              <p><strong>Group ID:</strong> ${group.id}</p>
              <p><strong>Created At:</strong> ${new Date(group.created_at).toLocaleString()}</p>
              <p><strong>Status:</strong> ${group.is_active ? "Active" : "Inactive"}</p>
              ${membersHTML}
            </div>
            <div class="group-actions">
              <button class="group-btn delete" data-id="${group.id}">Delete</button>
            </div>
          </div>
        `;
      })
      .join("");

    document.querySelectorAll(".group-btn.delete").forEach((button) => {
      button.addEventListener("click", async () => {
        const groupId = button.getAttribute("data-id");
        const confirmed = confirm("Are you sure you want to deactivate this group?");
        if (!confirmed) return;

        const { error } = await supabase
          .from("group")
          .update({ is_active: false })
          .eq("id", groupId);

        if (!error) {
          groups = groups.map((g) =>
            g.id === groupId ? { ...g, is_active: false } : g
          );
          renderGroups(searchInput.value);
        }
      });
    });
  }

  searchInput.addEventListener("input", () => renderGroups(searchInput.value));
  renderGroups();
}

// ----------------- LOAD EXPENSES -----------------
async function loadExpenses() {
    const expenseList = document.getElementById("expenseList");
    const searchInput = document.getElementById("expenseSearch");
  
    const { data: expenses, error } = await supabase
      .from("expense")
      .select(`
        id,
        description,
        amount,
        is_verified,
        created_at,
        split_type,
        category,
        group_id,
        group (
          name
        ),
        paid_by,
        group_member:paid_by (
          id,
          user_id,
          users (
            id,
            name
          )
        )
      `)
      .order("created_at", { ascending: false });
  
    if (error) {
      console.error(error);
      expenseList.innerHTML = `<p class="error">Failed to load expenses</p>`;
      return;
    }
  
    function renderExpenses(filter = "") {
        const filtered = expenses.filter((expense) => {
          const descriptionMatch = expense.description?.toLowerCase().includes(filter.toLowerCase());
          const groupMatch = expense.group?.name?.toLowerCase().includes(filter.toLowerCase());
          const userMatch = expense.group_member?.users?.name?.toLowerCase().includes(filter.toLowerCase());
          
          const dateMatch = new Date(expense.created_at).toLocaleString().toLowerCase().includes(filter.toLowerCase());
      
          return descriptionMatch || groupMatch || userMatch || dateMatch;
        });
      
        if (filtered.length === 0) {
          expenseList.innerHTML = `<div class="empty-expense-state" style="width: 100%;margin-top:50px;text-align: center; font-size: 20px; color: #333;">No expenses found!</div>`;
          return;
        }
      
        expenseList.innerHTML = `
          <table class="expense-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Paid By</th>
                <th>Group</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(expense => `
                <tr>
                  <td>${expense.description || "Unnamed Expense"}</td>
                  <td>${expense.group_member?.users?.name || "Unknown"}</td>
                  <td>${expense.group?.name || "Unknown Group"}</td>
                  <td> ₹${expense.amount}</td>
                  <td>${new Date(expense.created_at).toLocaleString()}</td>
                  <td class="${expense.is_verified ? 'verified' : 'unverified'}">
                    ${expense.is_verified ? "Verified" : "Unverified"}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }
    searchInput.addEventListener("input", () =>
      renderExpenses(searchInput.value)
    );
  
    renderExpenses(); 
  }


  async function populateActivityTypes() {
    const filter = document.getElementById("filterType");
    if (!filter) return;
  
    filter.innerHTML = ""; 
 
    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "All";
    filter.appendChild(allOption);
 
    const { data, error } = await supabase
      .from("activity_log")
      .select("type")
      .neq("type", null);
  
    if (error) {
      console.error("Error fetching activity types:", error);
      return;
    }
  
    const uniqueTypes = [...new Set(data.map((log) => log.type))];
  
    uniqueTypes.forEach((type) => {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type;
      filter.appendChild(option);
    });
  }
  
  async function loadActivityLogs(filterType = "") {
    const { data: logs, error } = await supabase
      .from("activity_log")
      .select("*, users(name)")
      .order("created_at", { ascending: false });
  
    const tbody = document.querySelector("#activityLogTable tbody");
    if (!tbody) return;
  
    if (error) {
      console.error("Error loading activity logs:", error);
      tbody.innerHTML = `<tr><td colspan="4">Failed to load logs</td></tr>`;
      return;
    }
  
    const filteredLogs = filterType
      ? logs.filter((log) => log.type === filterType)
      : logs;
  
    if (filteredLogs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No logs found</td></tr>`;
      return;
    }
  
    tbody.innerHTML = filteredLogs
      .map((log) => `
        <tr>
          <td>${log.description}</td>
          <td>${log.users?.name || "Unknown"}</td>
          <td>${log.type}</td>
          <td>${new Date(log.created_at).toLocaleString()}</td>
        </tr>
      `)
      .join("");
  }

  async function loadStats() {
  const [usersRes, groupsRes, expenseAmountRes, settlementAmountRes] = await Promise.all([
    supabase.from("users").select("id"),
    supabase.from("group").select("id"),
    supabase.from("expense").select("amount"),
    supabase.from("settlement").select("amount"),
  ]);

  const totalUsers = usersRes.data?.length || 0;
  const totalGroups = groupsRes.data?.length || 0;
  const totalExpenses = expenseAmountRes.data?.length || 0;
  const totalSettlements = settlementAmountRes.data?.length || 0;
  

  console.log(`Total Users: ${totalUsers}`);
  console.log(`Total Groups: ${totalGroups}`);
  console.log(`Total Expense Amount: ${totalExpenses}`);
  console.log(`Total Settlement Amount: ${totalSettlements}`);
  
    document.getElementById("totalUsersCard").innerHTML = `
      <div style="background:#f8f9fa;padding:20px;border-radius:12px;box-shadow:0 2px 6px rgba(0,0,0,0.1);text-align:center;">
        <h3 style="font-size:1.2rem;color:#333;">Total Users</h3>
        <p style="font-size:2rem;font-weight:bold;margin:10px 0;">${totalUsers}</p>
      </div>
    `;
  
    document.getElementById("totalGroupsCard").innerHTML = `
      <div style="background:#f8f9fa;padding:20px;border-radius:12px;box-shadow:0 2px 6px rgba(0,0,0,0.1);text-align:center;">
        <h3 style="font-size:1.2rem;color:#333;">Total Groups</h3>
        <p style="font-size:2rem;font-weight:bold;margin:10px 0;">${totalGroups}</p>
      </div>
    `;
  
    document.getElementById("totalExpensesCard").innerHTML = `
      <div style="background:#f8f9fa;padding:20px;border-radius:12px;box-shadow:0 2px 6px rgba(0,0,0,0.1);text-align:center;">
        <h3 style="font-size:1.2rem;color:#333;">Total Expenses</h3>
        <p style="font-size:2rem;font-weight:bold;margin:10px 0;">${totalExpenses}</p>
      </div>
    `;
  
    document.getElementById("totalSettlementsCard").innerHTML = `
      <div style="background:#f8f9fa;padding:20px;border-radius:12px;box-shadow:0 2px 6px rgba(0,0,0,0.1);text-align:center;">
        <h3 style="font-size:1.2rem;color:#333;">Total Settlements</h3>
        <p style="font-size:2rem;font-weight:bold;margin:10px 0;">${totalSettlements}</p>
      </div>
    `;
  }

  async function fetchStatsData() {
    const { data: expenses, error } = await supabase.from("expense").select("amount, category, group_id, split_type");
  
    if (error) {
      console.error("Error fetching expenses:", error);
      return;
    }
  
    const groupTotals = {};
    const categoryTotals = {};
    const splitTypeTotals = {};  
  

    const { data: groups, groupError } = await supabase.from("group").select("id, name");
    if (groupError) {
      console.error("Error fetching groups:", groupError);
      return;
    }
  
    if (!expenses.length) {
      console.log("No expenses found.");
      return; 
    }
  
    if (!groups.length) {
      console.log("No groups found.");
      return; 
    }
  
   
    const groupNames = {};
    groups.forEach(group => {
      groupNames[group.id] = group.name;
    });
  
   
    expenses.forEach(expense => {
      const groupName = groupNames[expense.group_id] || "Unknown Group"; 
      const category = expense.category || "Other"; 
      const splitType = expense.split_type || "Unknown Split Type"; 
  
      groupTotals[groupName] = (groupTotals[groupName] || 0) + expense.amount;
      categoryTotals[category] = (categoryTotals[category] || 0) + expense.amount;
      splitTypeTotals[splitType] = (splitTypeTotals[splitType] || 0) + expense.amount;
    });
    
    renderBarChart(groupTotals);
    renderPieChart(categoryTotals);
    renderSplitTypePieChart(splitTypeTotals);
  }

function renderBarChart(groupTotals) {
  const ctx = document.getElementById("expensesBarChart").getContext("2d");
  if (barChartInstance) barChartInstance.destroy();

  barChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(groupTotals),
      datasets: [{
        label: "Total Expenses",
        data: Object.values(groupTotals),
        backgroundColor: "#4e79a7"
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: "Expenses per Group" }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

function renderPieChart(categoryTotals) {
  const ctx = document.getElementById("expenseTypesPieChart").getContext("2d");
  if (pieChartInstance) pieChartInstance.destroy();

  pieChartInstance = new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(categoryTotals),
      datasets: [{
        data: Object.values(categoryTotals),
        backgroundColor: [
          "#4e79a7", "#f28e2c", "#e15759", "#76b7b2",
          "#59a14f", "#edc949", "#af7aa1", "#ff9da7"
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: "Expenses by Category" }
      }
    }
  });
}

function renderSplitTypePieChart(splitTypeTotals) {
    const ctx = document.getElementById("splitTypesPieChart").getContext("2d");
  
    if (piechart) piechart.destroy(); 
  
    piechart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: Object.keys(splitTypeTotals),
        datasets: [{
          data: Object.values(splitTypeTotals),
          backgroundColor: [
            "#4e79a7", "#f28e2c", "#e15759", "#76b7b2",
            "#59a14f", "#edc949", "#af7aa1", "#ff9da7"
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: "Expenses by Split Type" }
        }
      }
    });
}


async function initAdminProfileLogic() {
    const viewSection = document.getElementById("viewAdminProfile");
    const editSection = document.getElementById("editAdminSection");
  
    const editBtn = document.getElementById("editAdminBtn");
    const nameField = document.getElementById("adminName");
    const emailField = document.getElementById("adminEmail");
    const passwordField = document.getElementById("adminPassword");
    const saveBtn = editSection.querySelector("button[type='submit']");
  
    const displayName = document.getElementById("adminProfileName");
    const displayEmail = document.getElementById("adminProfileEmail");
    const displayCreated = document.getElementById("adminCreatedAt");
  

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      console.error("Error fetching admin user:", error);
      return;
    }
  
    const { data: adminData, error: adminError } = await supabase
      .from("admin")
      .select("*")
      .eq("email", user.email)
      .single();
  
    if (adminError || !adminData) {
      console.error("Error fetching admin profile:", adminError);
      return;
    }
  
    displayName.innerText = `${adminData.name}`;
    displayEmail.innerText = adminData.email;
    displayCreated.innerText = new Date(adminData.created_at).toLocaleString();
  
    nameField.value = adminData.name;
    emailField.value = adminData.email;

    editBtn.addEventListener("click", () => {
      viewSection.style.display = "none";
      editSection.style.display = "block";
    });
  
   
    editSection.addEventListener("submit", async (e) => {
      e.preventDefault();
  
      const newName = nameField.value.trim();
      const newPassword = passwordField.value.trim();
  
     
      const { error: nameError } = await supabase
        .from("admin")
        .update({ name: newName })
        .eq("email", adminData.email);
  
      if (nameError) {
        alert("Error updating name: " + nameError.message);
        return;
      }
  
      if (newPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: newPassword
        });
  
        if (passwordError) {
          alert("Error updating password: " + passwordError.message);
          return;
        }
      }
  
      alert("Profile updated successfully!");
  
      displayName.innerText = `Admin Name: ${newName}`;
      viewSection.style.display = "block";
      editSection.style.display = "none";
      passwordField.value = "";
    });
}

  async function addAdmin(name, email, password) {
   
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
  
    if (error) {
      console.error("Error creating user:", error.message);
      alert("Failed to create admin account: " + error.message);
      return;
    }
  
    const { error: dbError } = await supabase.from("admin").insert({
      id: data.user.id, 
      name,
      email,
    });
  
    if (dbError) {
      console.error("Error inserting into admin table:", dbError.message);
      alert("Failed to save admin details: " + dbError.message);
      return;
    }
  
    alert("New admin added successfully!");
  }

async function setWelcomeMessage() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;

  if (!user) {
    console.warn("No user session found.");
    return;
  }

  const { data: allAdmins, error: allAdminsError } = await supabase.from("admin").select("*");
  console.log("All Admins:", allAdmins, allAdminsError);
  console.log("Session User ID:", user?.id);

  const { data: profile, error } = await supabase
    .from("admin")
    .select("name")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    console.error("Failed to fetch admin name:", error?.message || "No profile found");
    return;
  }

  const welcomeElement = document.getElementById("welcomeMessage");

  if (welcomeElement) {
    welcomeElement.textContent = `Welcome ${profile.name} to SplitEx !`;
  } else {
    console.warn("#welcomeMessage element not found");
  }
}
