import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://sfegijeyprgxqfkehnqa.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmZWdpamV5cHJneHFma2VobnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3MjE5MDAsImV4cCI6MjA1NzI5NzkwMH0.NLxgYcZ-d6lTZRWf7DQ6pOmjUhsESjO8AEAZV0Vk4CI";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

supabase.auth.getSession().then(({ data: { session } }) => {
  if (!session) {
    window.location.href = "index.html";
  }
});

async function setWelcomeMessage() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;

  if (!user) return;

  const { data: profile, error } = await supabase
    .from("users")
    .select("name")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Failed to fetch user name:", error.message);
    return;
  }

  document.getElementById("welcomeMessage").textContent = `Welcome ${profile.name} to SplitEx !`;
}

setWelcomeMessage();
setupLogoutListener();

export async function loadDashboardStats() {
  const { data: session, error: sessionError } = await supabase.auth.getSession();
  const user = session?.session?.user;

  if (sessionError || !user) {
    console.error("User not found");
    return;
  }

  const userId = user.id;

  const { data: groupMembers, error: gmError } = await supabase
    .from("group_member")
    .select("id, group_id, group(is_active)")
    .eq("user_id", userId)
    .eq("is_removed", false);

  if (gmError || !groupMembers) {
    console.error("Error fetching group memberships:", gmError);
    return;
  }

  const activeGroupMembers = groupMembers.filter(gm => gm.group?.is_active);
  const groupMemberIds = activeGroupMembers.map((gm) => gm.id);
  const groupIds = activeGroupMembers.map((gm) => gm.group_id);

  const { data: friends, error: friendError } = await supabase
    .from("friends")
    .select("friend")
    .eq("userid", userId);

  if (friendError || !friends) {
    console.error("Error fetching friends:", friendError);
    return;
  }

  const { data: splits, error: splitError } = await supabase
    .from("Expense_split")
    .select("amount_owed")
    .in("user_id", groupMemberIds);

  if (splitError || !splits) {
    console.error("Error fetching splits:", splitError);
    return;
  }

  const totalOwed = splits.reduce((sum, s) => sum + (s.amount_owed || 0), 0);

  document.getElementById("totalGroups").textContent = groupIds?.length || 0;
  document.getElementById("totalFriends").textContent = friends?.length || 0;
  document.getElementById("totalExpenses").textContent = `₹${totalOwed.toFixed(2)}`;
}

loadDashboardStats();

function loadGroupPage(groupId) {
  console.log("Loading group page with groupId:", groupId);
  fetch('group-page.html')
    .then(res => res.text())
    .then(html => {
      document.getElementById('content').innerHTML = html;
      import('./group-page.js').then(module => {
        if (groupId) {
          module.openGroupPage(groupId); 
        }
      });
    });
}

async function loadPage(page) {
 
  const content = document.getElementById("content");
  content.innerHTML = `<div class="loader"></div>`;
  
  try {

    const pageRes = await fetch(`pages/${page}`);
    const pageHtml = await pageRes.text();
    content.innerHTML = pageHtml;
  

    document.querySelectorAll("link[data-page-css]").forEach(link => link.remove());
  
    setupLogoutListener();

    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `assets/css/${page.replace(".html", ".css")}`;
    css.setAttribute("data-page-css", "true");
    document.head.appendChild(css);
  
    const loadModule = async (path, initFunction) => {
      const script = document.createElement("script");
      script.src = path;
      script.type = "module";
      script.onload = async () => {
        try {
          const module = await import(path.replace("assets/js/", "./"));
          if (module[initFunction]) module[initFunction]();
        } catch (err) {
          console.error(`Error initializing ${path}:`, err);
        }
      };
      document.body.appendChild(script);
    };
  
    switch (page) {
      case "friends.html":
        await loadModule("assets/js/friends.js", "initFriendInviteFeature");
        break;
      case "groups.html":
        await loadModule("assets/js/groups.js", "initGroupsPage");
        break;
      case "profile.html":
        await loadModule("assets/js/profile.js", "initProfilePage");
        break;
      case "settings.html":
        await loadModule("assets/js/settings.js", "initSettingsPage");
        break;
      case "editprofile.html":
        await loadModule("assets/js/editprofile.js", "initEditProfilePage");
        break;
      case "recent-activities.html":
        await loadModule("assets/js/recent-activities.js", "initRecentActivities");
        break;
      case "expenses.html":
        await loadModule("assets/js/expenses.js", "initAddExpensePage");
        break;
      case "settle-debts.html":
        await loadModule("assets/js/settle-debts.js", "initSettleDebtsPage");
        break;
      case "group-page.html":
        const groupId = window.pendingGroupId;
        const groupHtml = await fetch('group-page.html').then(r => r.text());
        content.innerHTML = groupHtml;
        const groupModule = await import('./group-page.js');
        if (groupId && groupModule.openGroupPage) groupModule.openGroupPage(groupId);
        break;
      case "reports.html":
        await loadModule("assets/js/reports.js", "initReportsPage");
        break;
      default:
        await loadModule(`assets/js/${page.replace(".html", ".js")}`, "init");
    }
  } catch (error) {
    console.error("Error loading page:", error);
    content.innerHTML = `<p>Failed to load the page. Please try again later.</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("groupsOption").addEventListener("click", () => loadPage("groups.html"));
  document.getElementById("expensesOption").addEventListener("click", () => loadPage("expenses.html"));
  document.getElementById("settleDebtsOption").addEventListener("click", () => loadPage("settle-debts.html"));
  document.getElementById("recentActivitiesOption").addEventListener("click", () => loadPage("recent-activities.html"));
  document.getElementById("friendsOption").addEventListener("click", () => loadPage("friends.html"));
  document.getElementById("reportsOption").addEventListener("click", () => loadPage("reports.html"));
  document.getElementById("profileOption").addEventListener("click", () => loadPage("profile.html"));
  document.getElementById("settingsOption").addEventListener("click", () => loadPage("settings.html"));

  setupLogoutListener()

  document.getElementById("profileBtn").addEventListener("click", () => {
    const menu = document.getElementById("dropdownMenu");
    menu.style.display = menu.style.display === "block" ? "none" : "block";
  });

  document.addEventListener("click", (e) => {
    const menu = document.getElementById("dropdownMenu");
    if (!e.target.closest(".profile-menu")) {
      menu.style.display = "none";
    }
  });
});

function setupLogoutListener() {
  const logoutOption = document.getElementById("logoutOption");

  if (logoutOption) {
    const newLogout = logoutOption.cloneNode(true);
    logoutOption.parentNode.replaceChild(newLogout, logoutOption);

    newLogout.addEventListener("click", () => {
      const modal = document.createElement("div");
      modal.innerHTML = `
        <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000;">
          <div style="background: white; padding: 20px 30px; border-radius: 12px; text-align: center; max-width: 300px;">
            <h3 style="margin-bottom: 10px;">🚪 Log Out</h3>
            <p style="margin-bottom: 20px;">Are you sure you want to log out?</p>
            <div style="display: flex; justify-content: center; gap: 12px;">
              <button id="logout-confirm" style=" padding: 8px 16px; background-color: #ef4444; color: white; border: none; border-radius: 6px;">Yes</button>
              <button id="logout-cancel" style=" padding: 8px 16px; background-color: #9ca3af; color: white; border: none; border-radius: 6px;">No</button>
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
          window.location.href = "index.html";
        }
        modal.remove();
      };
    });
  }
}