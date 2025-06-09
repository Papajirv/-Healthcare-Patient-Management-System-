document.addEventListener("DOMContentLoaded", () => {
  // pagination and sorting
  let currentPage = 1;
  let currentSortBy = 'createdAt';  // default sort field
  let currentSortOrder = 'desc';    // default order
  const limit = 5;                  // items per page

  //  It is to add patient form submission
  document.getElementById('patientForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const patient = {
      name: document.getElementById('name').value,
      age: Number(document.getElementById('age').value),
      gender: document.getElementById('gender').value,
      contact: document.getElementById('contact').value,
      patientId: document.getElementById('patientId').value,
      allergies: document.getElementById('allergies').value,
      medicalHistory: document.getElementById('medicalHistory').value,
      currentPrescriptions: document.getElementById('currentPrescriptions').value,
      doctorNotes: document.getElementById('doctorNotes').value
    };

    try {
      const response = await fetch('http://localhost:3000/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patient)
      });

      if (response.ok) {
        alert("Patient added successfully!");
        document.getElementById('patientForm').reset();
        loadPatients(currentPage);  // reload current page
      } else {
        alert("Failed to add patient.");
      }
    } catch (err) {
      console.error(err);
      alert("Error connecting to server.");
    }
  });

  // Load patients with pagination, sorting and optional search
  async function loadPatients(page = 1) {
    currentPage = page;

    try {
      const url = new URL('http://localhost:3000/api/patients');
      url.searchParams.append('page', currentPage);
      url.searchParams.append('limit', limit);
      url.searchParams.append('sortBy', currentSortBy);
      url.searchParams.append('order', currentSortOrder);

      const searchText = document.getElementById('searchInput').value.trim();
      if (searchText) {
        url.searchParams.append('search', searchText);
      }

      const res = await fetch(url);
      const result = await res.json();

      const data = result.data;

      if (!Array.isArray(data)) {
        console.error("Expected array but got:", data);
        return;
      }

      const tbody = document.getElementById('patient-table-body');
      tbody.innerHTML = '';

      data.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="border px-2 py-1">${p.patientId}</td>
          <td class="border px-2 py-1">${p.name}</td>
          <td class="border px-2 py-1">${p.age}</td>
          <td class="border px-2 py-1">${p.gender}</td>
          <td class="border px-2 py-1">${p.contact}</td>
          <td class="border px-2 py-1">${p.allergies || ''}</td>
          <td class="border px-2 py-1">${p.medicalHistory || ''}</td>
          <td class="border px-2 py-1">${p.currentPrescriptions || ''}</td>
          <td class="border px-2 py-1">${p.doctorNotes || ''}</td>
          <td class="border px-2 py-1 text-center">
            <button class="delete-btn text-red-600 hover:text-red-800" data-id="${p._id}" title="Delete Patient">🗑️</button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      setupDeleteButtons();

      renderPagination(result.totalPages, currentPage);

    } catch (err) {
      console.error("loadPatients error:", err);
    }
  }

  // Setup delete buttons event listeners
  function setupDeleteButtons() {
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (confirm("Are you sure you want to delete this patient?")) {
          try {
            const res = await fetch(`http://localhost:3000/api/patients/${id}`, {
              method: 'DELETE'
            });
            if (res.ok) {
              alert("Patient deleted successfully");
              loadPatients(currentPage);
            } else {
              alert("Failed to delete patient");
            }
          } catch (err) {
            console.error(err);
            alert("Error deleting patient");
          }
        }
      });
    });
  }

  // Render pagination buttons
  function renderPagination(totalPages, currentPage) {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.textContent = i;
      btn.className = `
        px-3 py-1 rounded 
        ${i === currentPage ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}
      `;
      btn.addEventListener('click', () => loadPatients(i));
      pagination.appendChild(btn);
    }
  }

  // Search patients function 
  window.searchPatients = () => {
    loadPatients(1); //
  };

  // Sorting change handlers called from index.html onchange attribute
  window.changeSort = (sortBy) => {
    currentSortBy = sortBy;
    loadPatients(1);  
  };

  window.changeOrder = (order) => {
    currentSortOrder = order;
    loadPatients(1);  
  };

  // chart rendering
  fetch("http://localhost:3000/api/patients/analytics/conditions")
    .then(res => res.json())
    .then(data => {
      const labels = data.map(item => item._id);
      const counts = data.map(item => item.count);

      const ctx = document.getElementById("conditionChart").getContext("2d");
      new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [{
            label: "Number of Patients",
            data: counts,
            backgroundColor: "rgba(75, 192, 192, 0.6)"
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    })
    .catch(err => console.error("Chart loading error:", err));

  
  loadPatients(currentPage);
});
