import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://sfegijeyprgxqfkehnqa.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmZWdpamV5cHJneHFma2VobnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3MjE5MDAsImV4cCI6MjA1NzI5NzkwMH0.NLxgYcZ-d6lTZRWf7DQ6pOmjUhsESjO8AEAZV0Vk4CI";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

document.addEventListener("DOMContentLoaded", async () => {
    const { data: { user } } = await supabase.auth.getUser();

    const previewImg = document.getElementById("editProfileImagePreview");
    const fileInput = document.getElementById("editProfileImageUpload");
    const editIcon = document.getElementById("editIcon");
    const photoInput = document.getElementById("editSelectedProfileImage");

    const { data, error } = await supabase.from("users").select("*").eq("id", user.id).single();
    
    if (data) {
        document.getElementById("name").value = data.name || "";
        document.getElementById("email").value = user.email || "";
        document.getElementById("phone").value = data.phone || "";
        document.getElementById("birthdate").value = data.birthdate || "";
        document.getElementById("gender").value = data.gender || "";
        previewImg.src = data.photo || "../assets/img/profilelogo.jpg";  
        photoInput.value = data.photo || ""; 
    }

    editIcon.addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage.from("profilephotos").upload(filePath, file, {
            upsert: true
        });

        if (!uploadError) {
            const { data: publicUrl } = supabase.storage.from("profilephotos").getPublicUrl(filePath);
            previewImg.src = publicUrl.publicUrl;
            photoInput.value = publicUrl.publicUrl; 
        } else {
            alert("Upload failed.");
        }
    });

    document.getElementById("editProfileForm").addEventListener("submit", async (e) => {
        e.preventDefault();

        const updates = {
            id: user.id,
            name: document.getElementById("name").value,
            phone: document.getElementById("phone").value,
            birthdate: document.getElementById("birthdate").value,
            gender: document.getElementById("gender").value,
            photo: photoInput.value
        };

        const { error } = await supabase.from("users").upsert(updates);
        if (!error) {
            alert("Profile updated successfully!");
        } else {
            alert("Error updating profile.");
        }
    });
});