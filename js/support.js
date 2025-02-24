document.getElementById("contactForm").addEventListener("submit", function(event) {
    event.preventDefault(); // Prevents form from reloading the page

    let isValid = true;

    // Get form values
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const message = document.getElementById("message").value.trim();

    // Get error fields
    const nameError = document.getElementById("nameError");
    const emailError = document.getElementById("emailError");
    const phoneError = document.getElementById("phoneError");
    const messageError = document.getElementById("messageError");

    // Reset errors
    nameError.classList.add("hidden");
    emailError.classList.add("hidden");
    phoneError.classList.add("hidden");
    messageError.classList.add("hidden");

    // Validation checks
    if (!name) {
        nameError.classList.remove("hidden");
        isValid = false;
    }

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        emailError.classList.remove("hidden");
        isValid = false;
    }

    if (!phone) {
        phoneError.classList.remove("hidden");
        isValid = false;
    }

    if (!message) {
        messageError.classList.remove("hidden");
        isValid = false;
    }

    if (!isValid) return;

    // Collect form data
    const formData = {
        from_name: name,
        from_email: email,
        phone: phone,
        message: message,
        to_name: "Reshape Club",
        to_email: "reshapeclub.tech@gmail.com"
    };

    console.log("Sending email to admin:", formData);

    // 1️⃣ Send email to the Admin
    emailjs.send("service_vhk6olb", "template_t7ui4ql", formData)
        .then(response => {
            console.log("Email sent to Admin successfully!", response);

            // 2️⃣ Send auto-reply to the user
            const autoReplyParams = {
                from_name: "Reshape Club",
                to_name: formData.from_name,
                to_email: formData.from_email,
                phone: formData.phone
            };

            console.log("Sending auto-reply to user:", autoReplyParams);

            emailjs.send("service_vhk6olb", "template_5l58oz6", autoReplyParams)
                .then(() => {
                    showPopup();
                    document.getElementById("contactForm").reset(); // Clears the form
                })
                .catch(error => {
                    console.error("Error sending auto-reply:", error);
                    alert("Message sent, but confirmation email failed.");
                });
        })
        .catch(error => {
            console.error("Error sending email:", error);
            alert("Error sending message. Please try again later.");
        });
});

// Function to show popup
function showPopup() {
    document.getElementById("successPopup").classList.remove("hidden");
}

// Function to close popup
function closePopup() {
    document.getElementById("successPopup").classList.add("hidden");
}
