(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  let currentUser = null;
  let institutions = [];
  let courses = [];

  async function api(url, method = "GET", body) {
    const options = {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" }
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Request failed");
    return data;
  }

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined && text !== null) {
      element.textContent = String(text);
    }
    if (className) element.className = className;
    return element;
  }

  function message(id, text, error = false) {
    const target = $(id);
    if (!target) return;
    target.textContent = text;
    target.style.color = error ? "#b91c1c" : "#166534";
  }

  function card(container, title, details = []) {
    const item = node("div");
    item.style.cssText =
      "border:1px solid #ddd;border-radius:10px;padding:14px;margin:10px 0;background:white";
    item.appendChild(node("h4", title));
    details.forEach(line => item.appendChild(node("p", line)));
    container.appendChild(item);
    return item;
  }

  function statusButton(parent, label, callback) {
    const button = node("button", label);
    button.type = "button";
    button.style.cssText = "margin:4px;padding:8px;cursor:pointer";
    button.addEventListener("click", callback);
    parent.appendChild(button);
  }

  function addSelect(parent, options, selected) {
    const select = node("select");
    select.style.cssText = "padding:9px;margin:5px;max-width:100%";
    options.forEach(option => {
      const item = node("option", option.label);
      item.value = option.value;
      if (option.value === selected) item.selected = true;
      select.appendChild(item);
    });
    parent.appendChild(select);
    return select;
  }

  function addInput(parent, id, placeholder, type = "text", required = false) {
    const input = node("input");
    input.id = id;
    input.type = type;
    input.placeholder = placeholder;
    input.required = required;
    input.style.cssText =
      "display:block;width:100%;box-sizing:border-box;padding:11px;margin:8px 0;border:1px solid #ccc;border-radius:7px";
    parent.appendChild(input);
    return input;
  }

  function addTextarea(parent, id, placeholder) {
    const input = node("textarea");
    input.id = id;
    input.placeholder = placeholder;
    input.rows = 3;
    input.style.cssText =
      "display:block;width:100%;box-sizing:border-box;padding:11px;margin:8px 0;border:1px solid #ccc;border-radius:7px";
    parent.appendChild(input);
    return input;
  }

  function addButton(parent, label, callback) {
    const button = node("button", label);
    button.type = "button";
    button.style.cssText =
      "padding:10px 15px;margin:6px 3px;border:0;border-radius:7px;background:#123b70;color:white;cursor:pointer";
    button.addEventListener("click", callback);
    parent.appendChild(button);
    return button;
  }

  function buildSection() {
    if ($("globalEducationCentre")) return;

    const section = node("section");
    section.id = "globalEducationCentre";
    section.style.cssText =
      "padding:20px;margin:20px auto;max-width:1100px;background:#f0f5ff;border-radius:14px";

    section.innerHTML = `
      <h2>🌍 BIHARI MART – Global Education & Admission Centre</h2>
      <p>Discover approved schools, colleges, universities and training institutes worldwide.</p>
      <p id="eduLoginStatus">Checking login...</p>
      <button id="eduRefresh">Refresh Education Centre</button>

      <div style="background:white;padding:15px;border-radius:10px;margin-top:15px">
        <h3>1. Approved Institutions</h3>
        <div id="eduInstitutions">Loading...</div>
      </div>

      <div style="background:white;padding:15px;border-radius:10px;margin-top:15px">
        <h3>2. Approved Courses & Admission</h3>
        <div id="eduCourses">Loading...</div>
      </div>

      <div id="eduInstitutionRegistration" style="background:white;padding:15px;border-radius:10px;margin-top:15px">
        <h3>3. Register Your School / College / University</h3>
        <p>Institution applications require admin approval before becoming public.</p>
        <form id="eduInstitutionForm">
          <input id="eduInstitutionName" placeholder="Institution Name" required maxlength="160">
          <select id="eduInstitutionType" required>
            <option value="">Select Institution Type</option>
            <option>School</option>
            <option>College</option>
            <option>University</option>
            <option>Training Institute</option>
          </select>
          <input id="eduCountry" placeholder="Country" required maxlength="100">
          <input id="eduCity" placeholder="City">
          <input id="eduEmail" type="email" placeholder="Official Email">
          <input id="eduWebsite" type="url" placeholder="Website URL (https://...)">
          <textarea id="eduRecognition" placeholder="Recognition / Accreditation Details" maxlength="2000"></textarea>
          <button type="submit">Submit Institution for Approval</button>
        </form>
        <p id="eduInstitutionMessage"></p>
      </div>

      <div id="eduCourseRegistration" style="background:white;padding:15px;border-radius:10px;margin-top:15px">
        <h3>4. Add a Course (Approved Institution Owner)</h3>
        <p>Only the owner of an approved institution can add courses.</p>
        <form id="eduCourseForm">
          <select id="eduCourseInstitution" required>
            <option value="">Select Your Approved Institution</option>
          </select>
          <input id="eduCourseName" placeholder="Course Name" required maxlength="160">
          <input id="eduCourseCategory" placeholder="Course Category" required maxlength="100">
          <textarea id="eduCourseDescription" placeholder="Course Description" maxlength="3000"></textarea>
          <input id="eduCourseDuration" placeholder="Duration (e.g. 2 years)">
          <select id="eduCourseMode">
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="hybrid">Hybrid</option>
          </select>
          <input id="eduCourseFee" type="number" min="0" step="0.01" placeholder="Course Fee">
          <select id="eduCourseCurrency">
            <option>INR</option><option>USD</option><option>EUR</option>
            <option>GBP</option><option>AED</option>
          </select>
          <button type="submit">Submit Course for Approval</button>
        </form>
        <p id="eduCourseMessage"></p>
      </div>

      <div id="eduStudentApplications" style="background:white;padding:15px;border-radius:10px;margin-top:15px">
        <h3>5. My Admission Applications (Student)</h3>
        <button id="eduMyApplications">View My Applications</button>
        <div id="eduMyApplicationsList"></div>
      </div>

      <div id="eduOwnerApplications" style="background:white;padding:15px;border-radius:10px;margin-top:15px">
        <h3>6. Institution Owner – Admission Applications</h3>
        <button id="eduOwnerRefresh">Refresh Student Applications</button>
        <div id="eduOwnerApplicationsList"></div>
      </div>

      <div id="eduAdminPanel" style="display:none;background:#fff7e6;padding:15px;border-radius:10px;margin-top:15px">
        <h3>7. Admin – Education Approval Dashboard</h3>
        <h4>Institution Applications</h4>
        <button id="eduAdminInstitutions">Refresh Institutions</button>
        <div id="eduAdminInstitutionList"></div>

        <h4>Course Applications</h4>
        <button id="eduAdminCourses">Refresh Courses</button>
        <div id="eduAdminCourseList"></div>

        <h4>Student Admission Applications</h4>
        <button id="eduAdminApplications">Refresh Admission Applications</button>
        <div id="eduAdminApplicationList"></div>
      </div>

      <p style="font-size:13px;color:#555;margin-top:20px">
        BIHARI MART is a platform for connecting students and institutions.
        Institution recognition, course validity, eligibility and final admission
        decisions must be verified with the relevant institution and authorities.
      </p>
    `;

    document.body.appendChild(section);

    section.querySelectorAll("input,textarea,select").forEach(input => {
      input.style.cssText =
        "display:block;width:100%;box-sizing:border-box;padding:11px;margin:8px 0;border:1px solid #ccc;border-radius:7px";
    });

    $("eduRefresh").onclick = refreshAll;
    $("eduMyApplications").onclick = loadMyApplications;
    $("eduOwnerRefresh").onclick = loadOwnerApplications;
    $("eduAdminInstitutions").onclick = loadAdminInstitutions;
    $("eduAdminCourses").onclick = loadAdminCourses;
    $("eduAdminApplications").onclick = loadAdminApplications;

    $("eduInstitutionForm").addEventListener("submit", submitInstitution);
    $("eduCourseForm").addEventListener("submit", submitCourse);
  }

  async function loadUser() {
    try {
      const data = await api("/api/me");
      currentUser = data.user || data;
      if (currentUser && !currentUser.role) currentUser = null;
    } catch {
      currentUser = null;
    }

    const loggedIn = currentUser && currentUser.role;
    $("eduLoginStatus").textContent = loggedIn
      ? "Logged in: " + currentUser.role
      : "Please login using the existing BIHARI MART Buyer / Seller / Admin login.";

    $("eduInstitutionRegistration").style.display = loggedIn ? "" : "none";
    $("eduCourseRegistration").style.display = loggedIn ? "" : "none";
    $("eduOwnerApplications").style.display = loggedIn ? "" : "none";
    $("eduStudentApplications").style.display =
      currentUser && currentUser.role === "buyer" ? "" : "none";
    $("eduAdminPanel").style.display =
      currentUser && currentUser.role === "admin" ? "" : "none";
  }

  async function loadInstitutions() {
    const data = await api("/api/education/institutions");
    institutions = data.institutions || [];
    const container = $("eduInstitutions");
    container.replaceChildren();

    if (!institutions.length) {
      container.appendChild(node("p", "No approved institutions listed yet."));
    }

    institutions.forEach(item => {
      card(container, item.institution_name, [
        item.institution_type,
        [item.city, item.country].filter(Boolean).join(", "),
        item.website || ""
      ].filter(Boolean));
    });

    const select = $("eduCourseInstitution");
    select.replaceChildren();
    const first = node("option", "Select Your Approved Institution");
    first.value = "";
    select.appendChild(first);

    institutions.forEach(item => {
      const option = node("option", item.institution_name + " – " + item.country);
      option.value = item.id;
      select.appendChild(option);
    });
  }

  async function loadCourses() {
    const data = await api("/api/education/courses");
    courses = data.courses || [];
    const container = $("eduCourses");
    container.replaceChildren();

    if (!courses.length) {
      container.appendChild(node("p", "No approved courses listed yet."));
    }

    courses.forEach(course => {
      const item = card(container, course.course_name, [
        "Institution: " + course.institution_name,
        "Category: " + course.category,
        "Location: " + [course.city, course.country].filter(Boolean).join(", "),
        "Mode: " + course.mode,
        "Duration: " + (course.duration || "Not specified"),
        "Fee: " + (course.fee === null ? "Contact institution" : course.fee + " " + course.currency),
        course.description || ""
      ]);

      if (currentUser && currentUser.role === "buyer") {
        const messageBox = addTextarea(item, "eduApplyMessage" + course.id,
          "Message to institution (optional)");
        addButton(item, "Apply for Admission", async () => {
          try {
            const result = await api(
              "/api/education/courses/" + encodeURIComponent(course.id) + "/apply",
              "POST",
              { message: messageBox.value }
            );
            alert(result.message);
            await loadMyApplications();
          } catch (error) {
            alert(error.message);
          }
        });
      } else if (!currentUser) {
        item.appendChild(node("p", "Login with a Buyer account to apply as a student."));
      }
    });
  }

  async function submitInstitution(event) {
    event.preventDefault();
    try {
      const result = await api("/api/education/institutions", "POST", {
        institutionName: $("eduInstitutionName").value,
        institutionType: $("eduInstitutionType").value,
        country: $("eduCountry").value,
        city: $("eduCity").value,
        email: $("eduEmail").value,
        website: $("eduWebsite").value,
        recognitionDetails: $("eduRecognition").value
      });
      message("eduInstitutionMessage", result.message + " Status: pending");
      event.target.reset();
    } catch (error) {
      message("eduInstitutionMessage", error.message, true);
    }
  }

  async function submitCourse(event) {
    event.preventDefault();
    const institutionId = $("eduCourseInstitution").value;
    if (!institutionId) {
      message("eduCourseMessage", "Select your approved institution.", true);
      return;
    }

    try {
      const result = await api(
        "/api/education/institutions/" + encodeURIComponent(institutionId) + "/courses",
        "POST",
        {
          courseName: $("eduCourseName").value,
          category: $("eduCourseCategory").value,
          description: $("eduCourseDescription").value,
          duration: $("eduCourseDuration").value,
          mode: $("eduCourseMode").value,
          fee: $("eduCourseFee").value || "",
          currency: $("eduCourseCurrency").value
        }
      );
      message("eduCourseMessage", result.message + " Status: pending");
      event.target.reset();
    } catch (error) {
      message("eduCourseMessage", error.message, true);
    }
  }

  async function loadMyApplications() {
    const container = $("eduMyApplicationsList");
    container.replaceChildren();
    try {
      const data = await api("/api/education/my-applications");
      if (!(data.applications || []).length) {
        container.appendChild(node("p", "You have not submitted any applications."));
      }
      (data.applications || []).forEach(app => {
        card(container, app.course_name, [
          "Institution: " + app.institution_name,
          "Location: " + [app.city, app.country].filter(Boolean).join(", "),
          "Application Status: " + app.status,
          "Submitted: " + new Date(app.created_at).toLocaleString(),
          app.message || ""
        ]);
      });
    } catch (error) {
      container.appendChild(node("p", error.message));
    }
  }

  async function loadOwnerApplications() {
    const container = $("eduOwnerApplicationsList");
    container.replaceChildren();
    try {
      const data = await api("/api/institution/education/applications");
      if (!(data.applications || []).length) {
        container.appendChild(node("p", "No student applications for your institutions."));
      }

      (data.applications || []).forEach(app => {
        const item = card(container, app.course_name, [
          "Institution: " + app.institution_name,
          "Student: " + app.student_name,
          "Phone: " + app.student_phone,
          "Status: " + app.status,
          "Message: " + (app.message || "")
        ]);
        const select = addSelect(item, [
          { value: "reviewing", label: "Reviewing" },
          { value: "accepted", label: "Accepted" },
          { value: "rejected", label: "Rejected" }
        ], app.status);
        statusButton(item, "Update Status", async () => {
          try {
            await api("/api/institution/education/applications/" +
              encodeURIComponent(app.id) + "/status", "PATCH",
              { status: select.value });
            alert("Application status updated.");
            loadOwnerApplications();
          } catch (error) {
            alert(error.message);
          }
        });
      });
    } catch (error) {
      container.appendChild(node("p", error.message));
    }
  }

  async function loadAdminInstitutions() {
    const container = $("eduAdminInstitutionList");
    container.replaceChildren();
    try {
      const data = await api("/api/admin/education/institutions");
      (data.institutions || []).forEach(item => {
        const box = card(container, item.institution_name, [
          item.institution_type,
          [item.city, item.country].filter(Boolean).join(", "),
          "Email: " + (item.email || "Not provided"),
          "Recognition: " + (item.recognition_details || "Not provided"),
          "Status: " + item.status
        ]);
        const select = addSelect(box, [
          { value: "pending", label: "Pending" },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" }
        ], item.status);
        statusButton(box, "Update Institution", async () => {
          try {
            await api("/api/admin/education/institutions/" +
              encodeURIComponent(item.id) + "/status", "PATCH",
              { status: select.value });
            alert("Institution status updated.");
            loadAdminInstitutions();
            loadInstitutions();
          } catch (error) {
            alert(error.message);
          }
        });
      });
      if (!(data.institutions || []).length) {
        container.appendChild(node("p", "No institution applications."));
      }
    } catch (error) {
      container.appendChild(node("p", error.message));
    }
  }

  async function loadAdminCourses() {
    const container = $("eduAdminCourseList");
    container.replaceChildren();
    try {
      const data = await api("/api/admin/education/courses");
      (data.courses || []).forEach(course => {
        const box = card(container, course.course_name, [
          "Institution: " + course.institution_name,
          "Category: " + course.category,
          "Fee: " + (course.fee === null ? "Not specified" : course.fee + " " + course.currency),
          "Status: " + course.status
        ]);
        const select = addSelect(box, [
          { value: "pending", label: "Pending" },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" }
        ], course.status);
        statusButton(box, "Update Course", async () => {
          try {
            await api("/api/admin/education/courses/" +
              encodeURIComponent(course.id) + "/status", "PATCH",
              { status: select.value });
            alert("Course status updated.");
            loadAdminCourses();
            loadCourses();
          } catch (error) {
            alert(error.message);
          }
        });
      });
      if (!(data.courses || []).length) {
        container.appendChild(node("p", "No course applications."));
      }
    } catch (error) {
      container.appendChild(node("p", error.message));
    }
  }

  async function loadAdminApplications() {
    const container = $("eduAdminApplicationList");
    container.replaceChildren();
    try {
      const data = await api("/api/admin/education/applications");
      (data.applications || []).forEach(app => {
        const box = card(container, app.course_name, [
          "Institution: " + app.institution_name,
          "Country: " + app.country,
          "Student: " + app.student_name,
          "Phone: " + app.student_phone,
          "Message: " + (app.message || ""),
          "Status: " + app.status
        ]);
        const select = addSelect(box, [
          { value: "new", label: "New" },
          { value: "reviewing", label: "Reviewing" },
          { value: "accepted", label: "Accepted" },
          { value: "rejected", label: "Rejected" }
        ], app.status);
        statusButton(box, "Update Application", async () => {
          try {
            await api("/api/admin/education/applications/" +
              encodeURIComponent(app.id) + "/status", "PATCH",
              { status: select.value });
            alert("Admission application status updated.");
            loadAdminApplications();
          } catch (error) {
            alert(error.message);
          }
        });
      });
      if (!(data.applications || []).length) {
        container.appendChild(node("p", "No admission applications."));
      }
    } catch (error) {
      container.appendChild(node("p", error.message));
    }
  }

  async function refreshAll() {
    try {
      await loadUser();
      await loadInstitutions();
      await loadCourses();

      if (currentUser && currentUser.role === "buyer") {
        await loadMyApplications();
      }
      if (currentUser) await loadOwnerApplications();

      if (currentUser && currentUser.role === "admin") {
        await loadAdminInstitutions();
        await loadAdminCourses();
        await loadAdminApplications();
      }
    } catch (error) {
      console.error("Education Centre:", error);
      $("eduInstitutions").textContent = error.message;
    }
  }

  function start() {
    buildSection();
    refreshAll();

    // Refresh Education Centre after existing login/logout actions.
    if (typeof window.loginUser === "function") {
      const originalLogin = window.loginUser;
      window.loginUser = function (...args) {
        const result = originalLogin.apply(this, args);
        setTimeout(refreshAll, 1000);
        return result;
      };
    }

    if (typeof window.logoutUser === "function") {
      const originalLogout = window.logoutUser;
      window.logoutUser = function (...args) {
        const result = originalLogout.apply(this, args);
        setTimeout(refreshAll, 500);
        return result;
      };
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
