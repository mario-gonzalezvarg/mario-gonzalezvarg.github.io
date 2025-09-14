document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  const slants = document.querySelectorAll(".section--slant");

  const onScroll = () => {
    let redActive = false;

    slants.forEach(section => {
      const rect = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // consider slant section "active" if its midpoint is in view
      const sectionMid = rect.top + rect.height / 2;
      if (sectionMid > 0 && sectionMid < viewportHeight) {
        redActive = true;
      }
    });

    if (redActive) {
      body.classList.add("red-bg");
    } else {
      body.classList.remove("red-bg");
    }
  };

  window.addEventListener("scroll", onScroll);
  onScroll(); // run on load
});
