import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://sfegijeyprgxqfkehnqa.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmZWdpamV5cHJneHFma2VobnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3MjE5MDAsImV4cCI6MjA1NzI5NzkwMH0.NLxgYcZ-d6lTZRWf7DQ6pOmjUhsESjO8AEAZV0Vk4CI";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function initFriendInviteFeature() {
  const form = document.getElementById("inviteForm");
  const friendListDiv = document.getElementById("friendList");
  const searchBox = document.getElementById("friendSearch");
  const statusMessage = document.getElementById("inviteStatus");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("inviteEmail").value.trim();
    const nickname = document.getElementById("nickname").value.trim();
    if (!email || !nickname || !email.includes("@")) {
      statusMessage.style.color = "red";
      statusMessage.textContent = "Please enter a valid email and nickname.";
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) {
      statusMessage.style.color = "red";
      statusMessage.textContent = "You must be logged in.";
      return;
    }

    const { data: friendUser, error: userError } = await supabase
      .from("users")
      .select("id, name")
      .eq("email", email)
      .single();

    if (userError || !friendUser) {
      statusMessage.style.color = "red";
      statusMessage.textContent = "No User Found";
      return;
    }

    const { data: currentUserData } = await supabase
      .from("users")
      .select("name")
      .eq("id", user.id)
      .single();

    const reverseNickname = currentUserData?.name || user.email;

    const { data: existing } = await supabase
      .from("friends")
      .select("*")
      .or(`and(userid.eq.${user.id},friend.eq.${friendUser.id}),and(userid.eq.${friendUser.id},friend.eq.${user.id})`);

    if (existing && existing.length >= 2) {
      statusMessage.style.color = "red";
      statusMessage.textContent = "You're already friends.";
      return;
    }

    const { error: insertError } = await supabase
      .from("friends")
      .insert([
        { userid: user.id, friend: friendUser.id, nickname },
        { userid: friendUser.id, friend: user.id, nickname: reverseNickname }
      ]);

    if (insertError) {
      statusMessage.style.color = "red";
      statusMessage.textContent = "Error adding friend.";
    } else {
    
      await supabase.from("activity_log").insert({
        user_id: user.id,
        description: `Added ${nickname} (${email}) as a friend.`,
        type: "friend_add"
      });

      statusMessage.style.color = "green";
      statusMessage.textContent = "Friend added successfully!";
      
      form.reset();
      loadFriends();
    }
  });

  async function loadFriends() {
    friendListDiv.innerHTML = "Loading...";

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) return;

    const { data, error } = await supabase
      .from("friends")
      .select("id, nickname, friend, users:friend (email, photo, phone)")
      .eq("userid", user.id);

    if (error) {
      friendListDiv.textContent = "Error loading friends.";
      return;
    }

    if (!data || data.length === 0) {
      friendListDiv.textContent = "No friends found.";
      return;
    }

    const sorted = data.sort((a, b) => a.nickname.localeCompare(b.nickname));

    friendListDiv.innerHTML = "";
    for (const entry of sorted) {
      const div = document.createElement("div");
      div.className = "friend-entry";

      const img = document.createElement("img");
      img.src = entry.users?.photo || "default.jpg";
      img.alt = "Profile";
      img.className = "friend-photo";

      const info = document.createElement("div");
      info.className = "friend-info";
      info.innerHTML = `
        <strong>${entry.nickname}</strong><br/>
        ${entry.users?.email || "No email"}<br/>
        ${entry.users?.phone || "No phone"}
      `;

      const btn = document.createElement("button");
      btn.textContent = "Remove";
      btn.className = "remove-friend";
      btn.addEventListener("click", async () => {
        const { error: deleteError } = await supabase
          .from("friends")
          .delete()
          .or(`and(userid.eq.${user.id},friend.eq.${entry.friend}),and(userid.eq.${entry.friend},friend.eq.${user.id})`);

        if (!deleteError) {
          await supabase.from("activity_log").insert({
            user_id: user.id,
            description: `Removed friend ${entry.nickname} (${entry.users?.email})`,
            type: "friend_remove"
          });

          loadFriends();
        }
      });

      div.appendChild(img);
      div.appendChild(info);
      div.appendChild(btn);
      friendListDiv.appendChild(div);
    }
  }

  searchBox.addEventListener("input", () => {
    const value = searchBox.value.toLowerCase();
    const entries = document.querySelectorAll(".friend-entry");
    entries.forEach((entry) => {
      const match = entry.textContent.toLowerCase().includes(value);
      entry.style.display = match ? "" : "none";
    });
  });

  loadFriends();
}