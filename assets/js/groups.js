import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://sfegijeyprgxqfkehnqa.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmZWdpamV5cHJneHFma2VobnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3MjE5MDAsImV4cCI6MjA1NzI5NzkwMH0.NLxgYcZ-d6lTZRWf7DQ6pOmjUhsESjO8AEAZV0Vk4CI";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let groups = [];
let friends = [];
let currentUserId;

export async function initGroupsPage() {
    const addGroupBtn = document.getElementById("addGroupBtn");
    const groupModal = document.getElementById("groupModal");
    const closeModal = document.getElementById("closeModal");
    const createGroupBtn = document.getElementById("createGroup");
    const groupNameInput = document.getElementById("groupNameInput");
    const groupList = document.getElementById("groupList");
    const addMemberBtn = document.getElementById("addMemberBtn");
    const membersContainer = document.getElementById("membersContainer");
    const groupPhotoInput = document.getElementById("groupPhoto");

    createGroupBtn.style.width = "267px";
    closeModal.style.width = "265px";

    const loader = document.createElement("div");
    loader.id = "groupLoader";
    loader.style.display = "none";
    loader.innerHTML = `
        <div class="spinner"></div>
        <style>
            .spinner {
                margin: 40px auto;
                border: 5px solid #f3f3f3;
                border-top: 5px solid #0077ff;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;

    const popup = createOrGetSettlePopup();
    groupList.parentElement.insertBefore(loader, groupList);

    const user = (await supabase.auth.getUser()).data.user;
    currentUserId = user.id;

    const { data: friendsData } = await supabase
        .from("friends")
        .select("friend, nickname, users:friend (id)")
        .eq("userid", currentUserId);

    friends = friendsData.map(f => ({
        user_id: f.friend,
        nickname: f.nickname
    }));

    addGroupBtn.onclick = () => {
        groupModal.style.display = "block";
        membersContainer.innerHTML = "";
        addMemberField();
    };

    closeModal.onclick = () => {
        groupModal.style.display = "none";
        membersContainer.innerHTML = "";
        groupNameInput.value = "";
        groupPhotoInput.value = "";
    };

    createGroupBtn.onclick = async () => {
        const groupName = groupNameInput.value.trim();
        if (!groupName) return alert("Group name is required.");

        const selectedMembers = Array.from(document.querySelectorAll(".member-select"))
            .filter(select => select.value !== "")
            .map(select => select.value);

        const uniqueIds = new Set(selectedMembers);
        if (uniqueIds.size !== selectedMembers.length) return alert("Duplicate members selected.");

        const groupPhotoFile = groupPhotoInput.files[0];
        let groupPhotoUrl = null;

        loader.style.display = "block";

        if (groupPhotoFile) {
            const filePath = `group-photos/${Date.now()}-${groupPhotoFile.name}`;
            const { error: uploadError } = await supabase.storage.from("group-assets").upload(filePath, groupPhotoFile);
            if (uploadError) {
                loader.style.display = "none";
                return alert("Failed to upload group photo.");
            }
            groupPhotoUrl = supabase.storage.from("group-assets").getPublicUrl(filePath).data.publicUrl;
        }

        const { data: groupData, error: groupError } = await supabase
            .from("group")
            .insert({
                name: groupName,
                created_by: currentUserId,
                logo: groupPhotoUrl || null
            })
            .select()
            .single();

        if (groupError) {
            loader.style.display = "none";
            return alert("Failed to create group.");
        }

        const allUserIds = [currentUserId, ...selectedMembers];
        const { data: usersData, error: usersError } = await supabase
            .from("users")
            .select("id, name")
            .in("id", allUserIds);

        if (usersError || !usersData) {
            loader.style.display = "none";
            return alert("Failed to fetch user names.");
        }

        const members = usersData.map(user => ({
            user_id: user.id,
            group_id: groupData.id,
            is_admin: user.id === currentUserId,
            nickname: user.name
        }));

        const { error: memberError } = await supabase
            .from("group_member")
            .insert(members);

        if (memberError) {
            loader.style.display = "none";
            return alert("Failed to add members.");
        }

        await supabase.from("activity_log").insert({
            user_id: currentUserId,
            description: `Created group '${groupName}' with ${members.length} member${members.length > 1 ? "s" : ""}`,
            type: "group_create"
        });

        await loadGroups();
        groupModal.style.display = "none";
        membersContainer.innerHTML = "";
        groupNameInput.value = "";
        groupPhotoInput.value = "";
    };

    addMemberBtn.onclick = () => {
        if (membersContainer.children.length < 12) addMemberField();
    };

    function addMemberField() {
        const memberDiv = document.createElement("div");
        memberDiv.classList.add("member-input");

        const select = document.createElement("select");
        select.classList.add("member-select");

        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "Select a member";
        defaultOption.disabled = true;
        defaultOption.selected = true;
        select.appendChild(defaultOption);

        friends.forEach(friend => {
            const option = document.createElement("option");
            option.value = friend.user_id;
            option.textContent = friend.nickname;
            select.appendChild(option);
        });

        select.onchange = updateAllDropdowns;

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "✕";
        removeBtn.classList.add("remove-member");
        removeBtn.onclick = () => {
            membersContainer.removeChild(memberDiv);
            updateAllDropdowns();
        };

        memberDiv.appendChild(select);
        memberDiv.appendChild(removeBtn);
        membersContainer.appendChild(memberDiv);

        updateAllDropdowns();
    }

    function updateAllDropdowns() {
        const allSelects = document.querySelectorAll(".member-select");
        const selectedValues = Array.from(allSelects).map(sel => sel.value).filter(Boolean);

        allSelects.forEach(select => {
            Array.from(select.options).forEach(option => {
                option.disabled = option.value && selectedValues.includes(option.value) && select.value !== option.value;
            });
        });
    }

    window.onclick = (event) => {
        if (event.target === groupModal) {
            groupModal.style.display = "none";
        }
    };

    await loadGroups();

    async function loadGroups() {
      loader.style.display = "block";
    
      const { data: memberships, error: memberError } = await supabase
        .from("group_member")
        .select("group_id, group(id, name, logo, is_active)")
        .eq("user_id", currentUserId)
        .eq("is_removed", false);
    
      loader.style.display = "none";
    
      if (memberError || !memberships) {
        console.error("Failed to load memberships:", memberError?.message);
        return;
      }
    
      const activeGroups = memberships
        .map(m => m.group)
        .filter(g => g && g.is_active);
    
      if (activeGroups.length === 0) {
        groupList.innerHTML = "<p>No active groups found.</p>";
        return;
      }
    
      groups = activeGroups.map(group => ({
        id: group.id,
        name: group.name,
        logo: group.logo,
        activities: []
      }));
    
      updateGroupList();
    }

    function updateGroupList() {
        groupList.innerHTML = "";
        groups.forEach(group => {
            const div = document.createElement("div");
            div.classList.add("group-item");

            const img = document.createElement("img");
            img.src = group.logo || "../assets/img/profilelogo.jpg";
            img.alt = group.name;
            img.classList.add("group-photo");

            const nameSpan = document.createElement("span");
            nameSpan.textContent = group.name;

            div.appendChild(img);
            div.appendChild(nameSpan);

            div.onclick = async () => {
                window.pendingGroupId = group.id;
                try {
                    const response = await fetch("pages/group-page.html");
                    if (!response.ok) throw new Error("Failed to load group page.");

                    const groupPageHtml = await response.text();
                    const contentContainer = document.getElementById("contentContainer");

                    if (!contentContainer) {
                        console.error("contentContainer element not found in the DOM.");
                        return;
                    }

                    contentContainer.innerHTML = groupPageHtml;

                    await new Promise(resolve => setTimeout(resolve, 100));

                    if (typeof initGroupPage === "function") {
                        initGroupPage(group.id);
                    } else if (window.initGroupPage) {
                        window.initGroupPage(group.id);
                    } else {
                        console.warn("initGroupPage not defined yet.");
                    }
                } catch (error) {
                    console.error("Error loading group page:", error);
                }
            };

            groupList.appendChild(div);
        });
    }
}

export async function initGroupPage(groupId) {
  
const current = await getCurrentUserId();
  const { data: groupData, error: groupError } = await supabase
    .from("group")
    .select("*")
    .eq("id", groupId)
    .single();

  if (groupError) {
    console.error("Error loading group:", groupError.message);
    return;
  }

  const editGroupBtn = document.getElementById("editGroupBtn");
  const expenseAddBtn = document.getElementById("expenseAddBtn");
  const addExpense = document.getElementById("addExpense");
  
  expenseAddBtn.addEventListener('click', async () => {
    try {
      const groupId = window.pendingGroupId; 
  
      const res = await fetch("../pages/expenses.html");
      const html = await res.text();
      const container = document.getElementById("contentContainer");
      container.innerHTML = html;
 
      if (!document.querySelector('link[href="../assets/css/expenses.css"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "../assets/css/expenses.css";
        document.head.appendChild(link);
      }

      const module = await import("../js/expenses.js");
      if (module.initAddExpensePage) {
        module.initAddExpensePage();
      }
  
      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "✕";
      cancelBtn.title = "Cancel";
      cancelBtn.style.position = "absolute";
      cancelBtn.style.top = "20px";
      cancelBtn.style.right = "20px";
      cancelBtn.style.padding = "8px 14px";
      cancelBtn.style.border = "none";
      cancelBtn.style.borderRadius = "6px";
      cancelBtn.style.backgroundColor = "#f44336";
      cancelBtn.style.color = "white";
      cancelBtn.style.fontSize = "16px";
      cancelBtn.style.cursor = "pointer";
      cancelBtn.style.zIndex = "1000";
  
      cancelBtn.addEventListener("click", async () => {
        if (!groupId) return;
  
        const groupPage = await fetch("pages/group-page.html");
        const groupHtml = await groupPage.text();
        container.innerHTML = groupHtml;
  
        await new Promise(resolve => setTimeout(resolve, 100));
  
        if (typeof initGroupPage === "function") {
          initGroupPage(groupId);
        } else if (window.initGroupPage) {
          window.initGroupPage(groupId);
        }
      });
  
      container.style.position = "relative";
      container.appendChild(cancelBtn);
  
    } catch (error) {
      console.error("Failed to load expense page:", error);
    }
  });

  editGroupBtn.addEventListener('click', async () => {
    
    document.getElementById("expenseTableWrapper").style.display = "none";
    document.getElementById("groupMembersList").style.display = "none";
    document.getElementById("editGroupForm").style.display = "block";
  
    const groupNameInput = document.getElementById("editGroupName");
    const groupLogoInput = document.getElementById("editGroupLogo");
    const memberContainer = document.getElementById("addnewMembersContainer");

    if (memberContainer.dataset.loaded !== "true") {
      memberContainer.innerHTML = "";
      await loadAddMemberDropdown(groupId, current);
      memberContainer.dataset.loaded = "true";
    }
    const { data: groupData, error: groupError } = await supabase
      .from("group")
      .select("*")
      .eq("id", groupId)
      .single();
  
    if (groupError) {
      console.error("Failed to fetch group:", groupError);
      return alert("Unable to fetch group details.");
    }
  
    groupNameInput.value = groupData.name;
    groupNameInput.placeholder = groupData.name;
  
    const editForm = document.getElementById("editGroupFormContent");
    if (!editForm.dataset.bound) {
      editForm.dataset.bound = "true";
  
      editForm.addEventListener("submit", async (e) => {
        e.preventDefault();
  
        const updatedName = groupNameInput.value.trim();
        const groupLogoFile = groupLogoInput.files[0];
        let groupLogoUrl = groupData.logo;
  
        if (!updatedName) {
          return alert("Group name is required.");
        }
  
        if (groupLogoFile) {
          const filePath = `group-logos/${Date.now()}-${groupLogoFile.name}`;
          const { error: uploadError } = await supabase.storage.from("group-assets").upload(filePath, groupLogoFile);
  
          if (uploadError) {
            return alert("Failed to upload group logo.");
          }
  
          groupLogoUrl = supabase.storage.from("group-assets").getPublicUrl(filePath).data.publicUrl;
        }
  
        const { error: updateError } = await supabase
          .from("group")
          .update({
            name: updatedName,
            logo: groupLogoUrl || null,
          })
          .eq("id", groupId);
  
        if (updateError) {
          return alert("Failed to update group.");
        }
  
        await supabase.from("activity_log").insert({
          user_id: currentUserId,
          description: `Updated group '${updatedName}'`,
          type: "group_update",
        });
  
        showInfoModal("✅Group Updated", "You have successfully Updated the group.");
  
        document.getElementById("editGroupForm").style.display = "none";
        document.getElementById("groupInfoContainer").style.display = "block";
        await initGroupPage(groupId);
      });

      document.getElementById("leaveGroupBtn").addEventListener("click", () => {
        showConfirmationModal("Are you sure you want to leave this group?", async () => {
          const { data: memberData, error: memberError } = await supabase
            .from("group_member")
            .select("id")
            .eq("group_id", groupId)
            .eq("user_id", currentUserId)
            .single();
      
          if (memberError || !memberData) {
            console.error("Error finding your membership:", memberError);
            return alert("Failed to find your membership in this group.");
          }
      
          const { error: removeError } = await supabase
            .from("group_member")
            .update({ is_removed: true })
            .eq("id", memberData.id);
      
          if (removeError) {
            console.error("Failed to leave group:", removeError);
            return alert("Could not leave group.");
          }
      
          await supabase.from("activity_log").insert({
            user_id: currentUserId,
            description: `Left the group '${document.getElementById("groupName").textContent}'`,
            type: "group_leave"
          });
      
          document.getElementById("groupInfoContainer").style.display = "none";
          showInfoModal("✅ Left Group", "You have successfully left the group.");
           
            await loadGroups();
          
        });
      });

      document.getElementById("addMemeber").addEventListener("submit", async (e) => {
        e.preventDefault();
      
        const select = document.querySelector(".member-select");
  const selectedId = select?.value;
  if (!selectedId) return alert("Please select a friend to add.");
      
        const { data: userProfile } = await supabase
          .from("users")
          .select("name")
          .eq("id", selectedId)
          .single();
      
        const { error } = await supabase.from("group_member").insert({
          user_id: selectedId,
          group_id: groupId,
          is_admin: false,
          nickname: userProfile?.name || "New Member",
        });
      
        if (error) {
          console.error("Failed to add member:", error);
          return alert("Could not add member.");
        }
      
        await supabase.from("activity_log").insert({
          user_id: currentUserId,
          description: `Added ${userProfile?.name} to group '${groupData.name}'`,
          type: "member_add",
        });
      
        select.value = "";
        showInfoModal("✅ Member added", "You have successfully added a member to the group.");
        const { data: updatedMembers, error: memberErr } = await supabase
    .from("group_member")
    .select("*, users(name, photo)")
    .eq("group_id", groupId);

  renderGroupMembers(updatedMembers, memberErr, groupData, groupId);

      });
    }
  
    document.getElementById("cancelEditBtn").addEventListener("click", () => {
      document.getElementById("editGroupForm").style.display = "none";
      document.getElementById("groupInfoContainer").style.display = "block";
    
      const memberContainer = document.getElementById("addnewMembersContainer");
      memberContainer.dataset.loaded = "false";
      memberContainer.innerHTML = "";
    });
    
  });

  document.getElementById("groupName").textContent = groupData.name;
  document.getElementById("groupLogo").src = groupData.logo || "../assets/img/profilelogo.jpg";

  const session = await supabase.auth.getSession();
  const currentUserId = session?.data?.session?.user?.id;

  const { data: members, error: memberErr } = await supabase
    .from("group_member")
    .select(`
      user_id,
      is_admin,
      is_removed,
      joined_at,
      users (
        id,
        name,
        photo
      )
    `)
    .eq("group_id", groupId);


  if(!memberErr && members)
  {
    renderGroupMembers(members, memberErr, groupData, groupId);
  }

  const { data: expenses, error: expErr } = await supabase
    .from("expense")
    .select(`
      *,
      paid_by_member:paid_by (
        id,
        user_id,
        nickname,
        user:users!group_member_user_id_fkey (
          name
        )
      )
    `)
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (expErr) {
    console.error("Error fetching expenses:", expErr.message);
    return;
  }

  const totalExpense = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);

  const totalExpenseElement = document.getElementById("totalExpense");

  if (totalExpenseElement) {
    totalExpenseElement.textContent = `Total Expense: ₹${totalExpense}`;
  }

  const tableBody = document.querySelector("#expenseTable tbody");
  tableBody.innerHTML = "";
  
  for (const expense of expenses) {
    const row = document.createElement("tr");
  
    const { data: splits, error: splitErr } = await supabase
      .from("Expense_split")
      .select(`
        *,
        user_member:user_id (
          id,
          user:users!group_member_user_id_fkey (
            name
          )
        )
      `)
      .eq("exp_id", expense.id);
  
    const splitString = splits?.map(s => `${s.user_member.user.name}: ₹${(s.amount_owed)}`).join("<br>") || "-";
  
    const verifyBtn = document.createElement("button");
    verifyBtn.style.marginLeft = "10px"; 
    verifyBtn.textContent = expense.is_verified ? "Verified" : "Verify";
    verifyBtn.disabled = expense.is_verified || expense.paid_by_member?.user_id === currentUserId;
  
    verifyBtn.onclick = async () => {
      if (!confirm("Are you sure you want to verify this expense?")) return;
  
      const { error: verifyErr } = await supabase
        .from("expense")
        .update({ is_verified: true })
        .eq("id", expense.id);
  
      if (verifyErr) {
        alert("Failed to verify expense.");
        return;
      }
  
      const { error: splitErr } = await supabase
        .from("Expense_split")
        .update({ is_verified: true })
        .eq("exp_id", expense.id);
  
      if (splitErr) {
        alert("Failed to verify expense splits.");
        return;
      } else {
        await supabase.from("activity_log").insert({
          user_id: currentUserId,
          description: `Verified expense '${expense.description}' in group '${groupData.name}'`,
          type: "expense_verify"
        });
      }
  
      verifyBtn.textContent = "Verified";
      verifyBtn.disabled = true;
    };
  
const settleBtn = document.createElement("button");
settleBtn.style.marginLeft = "10px"; 
settleBtn.textContent = "Settle"; 

const { data: memberData, error: memberError } = await supabase
  .from("group_member")
  .select("id")
  .eq("group_id", expense.group_id)
  .eq("user_id", currentUserId)
  .single();

if (memberError || !memberData) {
  console.error("Error fetching group_member data:", memberError);
  alert("Failed to find your group membership.");
  return;
}

const currentUserGroupMemberId = memberData.id;

const { data: userSplitData, error: userSplitError } = await supabase
  .from("Expense_split")
  .select("is_settled, amount_paid")
  .eq("exp_id", expense.id)
  .eq("user_id", currentUserGroupMemberId)


if (userSplitError) {
  console.error("Error fetching user split data:", userSplitError);
  alert("Failed to fetch your split data.");
  return;
}

if (!userSplitData) {
  console.warn("No split data found for this expense.");
  return;
}

const shouldDisable = userSplitData.is_settled || userSplitData.amount_paid > 0 || expense.paid_by === currentUserGroupMemberId;

if (expense.is_settled) {
  settleBtn.textContent = "Settled";
  settleBtn.classList.add("settled", "disabled");
  settleBtn.disabled = true;
} else if (shouldDisable) {
  settleBtn.classList.add("disabled");
  settleBtn.disabled = true;
} else {
  settleBtn.classList.add("settle");
  settleBtn.disabled = false;
}

settleBtn.onclick = async () => {
  const now = new Date();

  const { data: memberData, error: memberError } = await supabase
    .from("group_member")
    .select("id")
    .eq("group_id", expense.group_id)
    .eq("user_id", currentUserId)
    .single();

  if (memberError || !memberData) {
    return alert("Couldn't fetch your group membership.");
  }

  const currentUserGroupMemberId = memberData.id;

  const { data: userSplit, error: splitErr } = await supabase
    .from("Expense_split")
    .select("is_verified, is_settled, amount_owed")
    .eq("exp_id", expense.id)
    .eq("user_id", currentUserGroupMemberId)
    .single();

  if (!userSplit?.is_verified) {
    const modal = document.createElement("div");
    modal.innerHTML = `
      <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;">
        <div style="background: white; padding: 20px; border-radius: 10px; text-align: center;">
          <h3>❗ Verification Required</h3>
          <p>Please verify this expense before settling it.</p>
          <button id="verify-warning-close" style="padding: 8px 16px; background-color: #ef4444; color: white; border: none; border-radius: 6px;">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById("verify-warning-close").onclick = () => modal.remove();
    return;
  }

  const amount = userSplit.amount_owed;
  const from = currentUserGroupMemberId;
  const to = expense.paid_by;
  const groupId = expense.group_id;
  const groupName = groupData.name;

  const popup = await createOrGetSettlePopup();
  popup.style.display = "flex";
  const payCashBtn = popup.querySelector("#pay-cash");
  const payOnlineBtn = popup.querySelector("#pay-online");
  const closeBtn = popup.querySelector("#popup-close");

  const handlePayment = async () => {
    const { error: insertError } = await supabase.from("settlement").insert({
      from, to, amount, group_id: groupId
    });

    if (insertError) {
      return alert("Payment failed. Try again.");
    }

    await supabase.from("Expense_split").update({
      is_settled: true,
      settled_at: now
    }).eq("exp_id", expense.id).eq("user_id", from);

    const { data: allSplits } = await supabase
      .from("Expense_split")
      .select("user_id, is_settled")
      .eq("exp_id", expense.id);

    const allSettled = allSplits.every(s =>
      s.user_id === to || s.is_settled
    );

    if (allSettled) {
      await supabase.from("Expense_split").update({
        is_settled: true,
        settled_at: now
      }).eq("exp_id", expense.id).eq("user_id", to);

      await supabase.from("expense").update({ is_settled: true }).eq("id", expense.id);
    }

    await supabase.from("activity_log").insert({
      user_id: currentUserId,
      description: `Settled ₹${amount} for '${expense.description}' in '${groupName}'`,
      type: "settlement"
    });

    popup.style.display = "none";
    settleBtn.textContent = "Settled";
    settleBtn.disabled = true;
    settleBtn.classList.add("disabled");
  };

  payCashBtn.onclick = async () => await handlePayment();

  payOnlineBtn.onclick = async () => {
    popup.style.display = "none"; 

    const { data: memberUser } = await supabase
    .from("group_member")
    .select("user_id") 
    .eq("id", to)
    .single();
 
  const { data: userInfo } = await supabase
    .from("users")
    .select("upi, name") 
    .eq("id", memberUser.user_id)
    .single();
    if (!userInfo?.upi) return alert("Recipient has no UPI ID.");

    const upiUrl = `upi://pay?pa=${userInfo.upi}&pn=${encodeURIComponent(userInfo.name)}&am=${amount}&cu=INR`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(upiUrl)}&size=200x200`;

    const qrPopup = document.createElement("div");
    qrPopup.id = "qrModal";
    qrPopup.innerHTML = `
      <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;">
        <div style="background: white; padding: 20px; border-radius: 10px; text-align: center;">
          <h3>UPI Payment</h3>
          <p>Pay ₹${amount} to ${userInfo.name}</p>
          <img src="${qrUrl}" style="width: 200px; border-radius: 12px; margin: 10px 0;" />
          <br>
          <button id="qr-paid" style="margin-right: 10px;">Paid</button>
          <button id="qr-close">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(qrPopup);

    document.getElementById("qr-paid").onclick = async () => {
      qrPopup.remove();
      await handlePayment();
    };

    document.getElementById("qr-close").onclick = () => {
      qrPopup.remove();
      popup.style.display = "none";
    };
  };

  closeBtn.onclick = () => {
    popup.style.display = "none";
  };
};

const deletebtn = document.createElement("button");
deletebtn.style.marginLeft = "10px"; 
deletebtn.textContent = "Delete";
deletebtn.style.backgroundColor = "#ff5c5c"

deletebtn.addEventListener("click", async () => {
  const confirmDelete = confirm("Are you sure you want to delete this expense?");
  if (!confirmDelete) return;

  try {

    const { error: splitError } = await supabase
      .from("Expense_split")
      .delete()
      .eq("exp_id", expense.id);

    const { error: expenseError } = await supabase
      .from("expense")
      .delete()
      .eq("id", expense.id);

    initGroupPage(groupId);
    alert("Expense deleted successfully!");
  } 
  catch (err) {
    console.error("Error during deletion:", err.message);
    alert("Unexpected error occurred.");
  }
});
    const formattedDate = new Date(expense.created_at).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
  
    const formattedTime = new Date(expense.created_at).toLocaleString("en-US", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
    });
  
    row.innerHTML = `
      <td>${expense.description || "-"}</td>
      <td>${formattedDate}</td>
      <td>${formattedTime}</td>
      <td>₹${(expense.amount)}</td>
      <td>${expense.paid_by_member?.user?.name || "Unknown"}</td>
      <td>${splitString}</td>
      <td></td>
    `;
    row.querySelector("td:last-child").appendChild(verifyBtn);
    row.querySelector("td:last-child").appendChild(settleBtn);
    row.querySelector("td:last-child").appendChild(deletebtn);
    tableBody.appendChild(row);
  }

  document.getElementById("closeGroupPageBtn").addEventListener("click", () => {
    const groupPageContainer = document.getElementById("groupInfoContainer");
    if (groupPageContainer) {
      groupPageContainer.style.display = "none";
    }
  });

  document.getElementById("memberListBtn").addEventListener("click", () => {
    document.getElementById("groupMembersList").style.display = "flex";
    document.getElementById("expenseTableWrapper").style.display = "none";
    document.getElementById("editGroupForm").style.display = "none";
  });

  document.getElementById("expenseListBtn").addEventListener("click", () => {
    document.getElementById("expenseTableWrapper").style.display = "block";
    document.getElementById("groupMembersList").style.display = "none";
    document.getElementById("editGroupForm").style.display = "none";
  });
}

async function createOrGetSettlePopup() {
  let popup = document.querySelector("#settle-popup");

  if (!popup) {
    const popupDiv = document.createElement("div");
    popupDiv.id = "settle-popup";
    popupDiv.style.display = "none"; 
    popupDiv.innerHTML = `
      <div class="popup-overlay" style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); z-index: 9998;"></div>
      <div class="popup-box" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 12px; z-index: 9999;">
        <p id="popup-message" style="text-align:center;">How would you like to settle?</p>
        <button id="pay-cash">Settle</button>
        <button id="pay-online">Pay Online</button>
        <button id="popup-close">Cancel</button>
      </div>
    `;
    document.body.appendChild(popupDiv);
    popup = popupDiv;
  }

  return popup;
}

async function loadAddMemberDropdown(groupId, currentUserId) {
  console.log('loadAddMemberDropdown called for groupId:', groupId);
  const container = document.getElementById("addnewMembersContainer");


  const { data: groupMembers, error: groupError } = await supabase
    .from("group_member")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("is_removed", false);

  if (groupError) {
    console.error("Failed to fetch group members:", groupError);
    return alert("Could not load group members.");
  }

  const existingMemberIds = groupMembers.map(m => m.user_id);

  const { data: friends, error: friendError } = await supabase
    .from("friends")
    .select("friend, users:friend (id, name)")
    .eq("userid", currentUserId);

  if (friendError) {
    console.error("Failed to load friends:", friendError);
    return alert("Could not load friends.");
  }

  if (!friends || friends.length === 0) {
    container.innerHTML = "<p>No friends to add.</p>";
    return;
  }

  const select = document.createElement("select");
  select.classList.add("member-select");
  select.style.width = "500px";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "-- Select a friend --";
  select.appendChild(defaultOption);

  friends.forEach(friend => {
    const user = friend.users;
    if (!user) return;

    const option = document.createElement("option");
    option.value = user.id;
    option.textContent = user.name;

    if (existingMemberIds.includes(user.id)) {
      option.disabled = true;
      option.textContent += " (already in group)";
    }

    select.appendChild(option);
  });

  container.appendChild(select);
}

async function getCurrentUserId() {
  const { data: sessionData, error } = await supabase.auth.getSession();
  
  if (error || !sessionData?.session?.user?.id) {
    console.error("Error fetching session or user ID:", error);
    return null;
  }

  return sessionData.session.user.id;
}

function showConfirmationModal(message, onConfirm) {
  const modal = document.createElement("div");
  modal.innerHTML = `
    <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000;">
      <div style="background: white; padding: 20px 30px; border-radius: 12px; text-align: center; max-width: 320px;">
        <h3 style="margin-bottom: 10px;">⚠️ Confirmation</h3>
        <p style="margin-bottom: 20px;">${message}</p>
        <div style="display: flex; justify-content: center; gap: 12px;">
          <button id="confirm-btn" style="padding: 8px 16px; background-color: #ef4444; color: white; border: none; border-radius: 6px;">Yes</button>
          <button id="cancel-btn" style="padding: 8px 16px; background-color: #9ca3af; color: white; border: none; border-radius: 6px;">No</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("cancel-btn").onclick = () => modal.remove();
  document.getElementById("confirm-btn").onclick = () => {
    modal.remove();
    onConfirm();
  };
}

function showInfoModal(title, message) {
  const modal = document.createElement("div");
  modal.innerHTML = `
    <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;">
      <div style="background: white; padding: 20px 30px; border-radius: 12px; text-align: center; max-width: 320px;">
        <h3 style="margin-bottom: 10px;">${title}</h3>
        <p style="margin-bottom: 20px;">${message}</p>
        <button id="info-ok-btn" style="padding: 8px 16px; background-color: #3b82f6; color: white; border: none; border-radius: 6px;">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById("info-ok-btn").onclick = () => modal.remove();
}

function renderGroupMembers(members, memberErr, groupData, groupId) {
  if (!memberErr && members) {
    const membersList = document.getElementById("groupMembersList");
    if (!membersList) return;

    membersList.innerHTML = "";
    const isCurrentUserAdmin = members.find(m => m.user_id === currentUserId)?.is_admin;

    members.forEach(member => {
      const profilePic = member.users?.photo || "../assets/img/profilelogo.jpg";
      const joinedAt = new Date(member.joined_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
      const isAdmin = member.is_admin ? `<span class="admin-badge">Admin</span>` : "";

      const div = document.createElement("div");
      div.classList.add("member");
      div.innerHTML = `
        <img src="${profilePic}" class="profile-pic" />
        <div class="member-info">
          <strong>${member.users?.name || "Unknown"} ${member.is_removed ? "(removed)" : ""}</strong> ${isAdmin}
          <div class="joined-date">Joined on ${joinedAt}</div>
        </div>
      `;

      if (isCurrentUserAdmin && !member.is_admin && !member.is_removed) {
        const removeBtn = document.createElement("button");
        removeBtn.classList.add("mini-btn", "red");
        removeBtn.textContent = "✕";
        removeBtn.style.marginLeft = "auto";

        removeBtn.onclick = async () => {
          showConfirmationModal(
            `Are you sure you want to remove <strong>${member.users?.name || "this member"}</strong> from the group?`,
            async () => {
              const { error } = await supabase
                .from("group_member")
                .update({ is_removed: true }) 
                .eq("group_id", groupId)
                .eq("user_id", member.user_id);

              if (error) {
                alert("Failed to remove member.");
                return;
              }

              await supabase.from("activity_log").insert({
                user_id: currentUserId,
                description: `Removed ${member.users?.name || "a member"} from group '${groupData.name}'`,
                type: "member_remove"
              });

              initGroupPage(groupId);
            }
          );
        };

        div.appendChild(removeBtn);
      }

      membersList.appendChild(div);
    });
  }
}