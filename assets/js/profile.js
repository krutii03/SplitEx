import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://sfegijeyprgxqfkehnqa.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmZWdpamV5cHJneHFma2VobnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3MjE5MDAsImV4cCI6MjA1NzI5NzkwMH0.NLxgYcZ-d6lTZRWf7DQ6pOmjUhsESjO8AEAZV0Vk4CI";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function initProfilePage() {
 
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
const user = sessionData?.session?.user;

if (!user || sessionError) {
  alert("User is not authenticated.");
  return;
}

  const { data: userData, error: fetchError } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!userData || fetchError) {
    console.error("Error fetching user data:", fetchError);
    return;
  }

  const profileName = document.getElementById("profileName");
  const profileEmail = document.getElementById("profileEmail");
  const profilePhone = document.getElementById("profilePhone");
  const profileBirthdate = document.getElementById("profileBirthdate");
  const profileGender = document.getElementById("profileGender");
  const profileImage = document.getElementById("profileImage");

  if (profileName) profileName.textContent = userData.name;
  if (profileEmail) profileEmail.textContent = user.email;
  if (profilePhone) profilePhone.textContent = userData.phone || "N/A";
  if (profileBirthdate) profileBirthdate.textContent = userData.birthdate || "N/A";
  if (profileGender) profileGender.textContent = userData.gender || "N/A";
  if (profileImage) profileImage.src = userData.photo || "../assets/img/profilelogo.jpg";

  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const phoneInput = document.getElementById("phone");
  const birthdateInput = document.getElementById("birthdate");
  const genderInput = document.getElementById("gender");
  const previewImg = document.getElementById("editProfileImagePreview");
  const photoInput = document.getElementById("editSelectedProfileImage");

  if (nameInput) nameInput.value = userData.name || "";
  if (emailInput) emailInput.value = user.email || "";
  if (phoneInput) phoneInput.value = userData.phone || "";
  if (birthdateInput) birthdateInput.value = userData.birthdate || "";
  if (genderInput) genderInput.value = userData.gender || "";
  if (previewImg) previewImg.src = userData.photo || "../assets/img/profilelogo.jpg";
  if (photoInput) photoInput.value = userData.photo || "";

const fileInput = document.getElementById("editProfileImageUpload");
const editIcon = document.getElementById("editIcon");

if (editIcon && fileInput && previewImg && photoInput) {
  editIcon.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.split(".").pop();
    const fileName = `${user.id}.${ext}`;
    const filePath = `${fileName}`;  

    const { error: uploadError } = await supabase.storage
      .from("profile-photos")
      .upload(filePath, file);
  
    if (uploadError) {
      alert("Failed to upload profile image.");
      return;
    }

    const { data: publicData, error: publicUrlError } = supabase.storage
      .from("profile-photos")
      .getPublicUrl(filePath);

    if (publicUrlError) {
      alert("Failed to fetch public URL for the uploaded image.");
      return;
    }

    if (publicData?.publicUrl) {
      previewImg.src = publicData.publicUrl;  
      photoInput.value = publicData.publicUrl;  
    }
  });
}

  const editBtn = document.getElementById("editProfileBtn");
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      const viewSection = document.getElementById("viewProfileSection");
      const editSection = document.getElementById("editProfileSection");
      if (viewSection) viewSection.style.display = "none";
      if (editSection) editSection.style.display = "block";
    });
  }

  const form = document.getElementById("editProfileSection");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("name").value || "";
      const phone = document.getElementById("phone").value || "";
      const birthdate = document.getElementById("birthdate").value || "";
      const gender = document.getElementById("gender").value || "";
      const photo = document.getElementById("editSelectedProfileImage").value || "";

      const { error: updateError } = await supabase
        .from("users")
        .update({
          name: name || "",
          phone: phone || "",
          birthdate: birthdate || "",
          gender: gender || "",
          photo: photo || ""
        })
        .eq("id", user.id);

      if (updateError) {
        alert("Failed to update profile.");
        return;
      }

      const { error: logError } = await supabase.from("activity_log").insert({
        user_id: user.id,
        description: "Updated profile information",
        type: "profile_update"
      });

      if (logError) {
        console.error("Error logging activity:", logError);
      }

      alert("Profile updated successfully!");
      await initProfilePage();

      const viewSection = document.getElementById("viewProfileSection");
      const editSection = document.getElementById("editProfileSection");
      if (editSection) editSection.style.display = "none";
      if (viewSection) viewSection.style.display = "block";
    });
  }
}