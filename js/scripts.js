/* Template: Reshape
   Description: Custom JS file for the Reshape App
*/

(function ($) {
	"use strict";
  
	// On Scroll Function
	$(window).on("scroll load", function () {
	  const $logoImage = $("#logo-image");
	  const $logoBlog = $("#logo-image-blog");
	  const navbarTop = $(".navbar").offset().top;
  
	  if (navbarTop > 60) {
		if (!$(".fixed-top").hasClass("top-nav-collapse")) {
		  $(".fixed-top").addClass("top-nav-collapse");
		  $(".nav-link").removeClass("text-white");
		  $logoImage.attr("src", "assets/reshape_color.webp");
		  $logoBlog.attr("src", "../assets/reshape_color.webp");
		}
	  } else {
		if ($(".fixed-top").hasClass("top-nav-collapse")) {
		  $(".fixed-top").removeClass("top-nav-collapse");
		  $(".nav-link").addClass("text-white");
		  $logoImage.attr("src", "assets/reshape_white.webp");
		  $logoBlog.attr("src", "../assets/reshape_white.webp");
		}
	  }
	});
  
	document.addEventListener("DOMContentLoaded", () => {
	  // ===========================
	  // HOME HERO VIDEO + BLURHASH
	  // ===========================
	  const homeVideo = document.getElementById("home-video");
	  const homePlaceholder = document.getElementById("blurhash-placeholder-home");
  
	  if (homeVideo) {
		// Make sure placeholder is visible initially
		if (homePlaceholder) {
		  homePlaceholder.style.display = "block";
		}
  
		const showVideo = () => {
		  // Fade in the video
		  homeVideo.classList.remove("opacity-0");
		  homeVideo.classList.add("opacity-100");
		  // Hide the placeholder
		  if (homePlaceholder) {
			homePlaceholder.style.display = "none";
		  }
		};
  
		const showPlaceholder = () => {
		  if (homePlaceholder) {
			homePlaceholder.style.display = "block";
		  }
		  // Optionally keep video hidden if it errors
		  homeVideo.classList.add("opacity-0");
		};
  
		homeVideo.addEventListener("loadeddata", showVideo);
		homeVideo.addEventListener("canplay", showVideo);
		homeVideo.addEventListener("error", showPlaceholder);
	  }
  
	  // ===========================
	  // ANIMATION ON SCROLL
	  // ===========================
	  const observer = new IntersectionObserver(
		(entries) => {
		  entries.forEach((entry) => {
			if (entry.isIntersecting) {
			  entry.target.classList.add("show");
			  observer.unobserve(entry.target);
			}
		  });
		},
		{
		  threshold: 0.1,
		}
	  );
  
	  document.querySelectorAll(".fade-in").forEach((element) => {
		observer.observe(element);
	  });
  
	  // ===========================
	  // Repuso widget script
	  // ===========================
	  var script = document.createElement("script");
	  script.type = "module";
	  script.src = "https://repuso.com/widgets/2.0/rw-widget-masonry.js";
	  document.getElementsByTagName("head")[0].appendChild(script);
  
	  // ===========================
	  // SHARE POPUP / COPY LINK
	  // ===========================
	  const viewBtn = document.querySelector(".btn-calendar1");
	  const popup = document.querySelector(".popup");
	  const backdrop = document.querySelector(".backdrop");
  
	  if (viewBtn && popup && backdrop) {
		const close = popup.querySelector(".close");
		const field = popup.querySelector(".field");
		const input = field ? field.querySelector("input") : null;
		const copy = field ? field.querySelector("button") : null;
  
		viewBtn.onclick = (e) => {
		  e.preventDefault();
		  popup.classList.toggle("show");
		};
  
		if (close) {
		  close.onclick = () => {
			viewBtn.click();
		  };
		}
  
		if (copy && input && field) {
		  copy.onclick = () => {
			input.select();
			if (document.execCommand("copy")) {
			  field.classList.add("active");
			  copy.innerText = "Copied";
			  setTimeout(() => {
				window.getSelection().removeAllRanges();
				field.classList.remove("active");
				copy.innerText = "Copy";
			  }, 3000);
			}
		  };
		}
  
		backdrop.addEventListener("click", function () {
		  popup.classList.remove("show");
		});
	  }
  
	  // ===========================
	  // FAQ accordion (jQuery version)
	  // ===========================
	  $(".accordion__header").on("click", function () {
		var accordion = $(this).parent();
		accordion.toggleClass("open");
		var icon = $(this).find(".fa");
		if (icon.hasClass("fa-plus")) {
		  icon.removeClass("fa-plus").addClass("fa-minus");
		} else {
		  icon.removeClass("fa-minus").addClass("fa-plus");
		}
		var content = accordion.find(".accordion__content");
		if (accordion.hasClass("open")) {
		  content.css("height", content.prop("scrollHeight") + "px");
		} else {
		  content.css("height", "0");
		}
	  });
  
	  // ===========================
	  // COOKIES BANNER
	  // ===========================
	  $("body").append(`
  <div id="cookie-banner" class="cookie-banner">
	<p>We use cookies to ensure you get the best experience on our website. <a href="/privacy.html">Learn more about our privacy policy</a>.</p>
	<button id="accept-cookies" class="cookie-button rounded-full">OK</button>
  </div>
	  `);
  
	  var $banner = $("#cookie-banner");
	  var $acceptButton = $("#accept-cookies");
  
	  if (!localStorage.getItem("cookiesAccepted")) {
		$banner.show();
	  }
  
	  $acceptButton.on("click", function () {
		localStorage.setItem("cookiesAccepted", "true");
		$banner.hide();
	  });
  
	  // Scroll to booking section
	  $(".scroll-to-booking").click(function () {
		$("html, body").animate(
		  {
			scrollTop: $("#booking-section").offset().top,
		  },
		  800
		);
	  });
	});
  
	// ===========================
	// FAQ accordion (vanilla version)
	// ===========================
	const accordions = document.querySelectorAll(".accordion");
  
	accordions.forEach((accordion, index) => {
	  const header = accordion.querySelector(".accordion__header");
	  const content = accordion.querySelector(".accordion__content");
	  const icon = accordion.querySelector(".accordion-icon");
  
	  header.addEventListener("click", () => {
		const isOpen = content.style.height === `${content.scrollHeight}px`;
  
		accordions.forEach((a, i) => {
		  const c = a.querySelector(".accordion__content");
		  const ic = a.querySelector(".accordion-icon");
  
		  c.style.height = i === index && !isOpen ? `${c.scrollHeight}px` : "0px";
		  ic.classList.toggle("ri-add-line", i !== index || !isOpen);
		  ic.classList.toggle("ri-subtract-fill", i === index && !isOpen);
		});
	  });
	});
  
	// ===========================
	// Menu Toggle for small devices
	// ===========================
	$('[data-toggle="offcanvas"], .nav-link:not(.dropdown-toggle)').on("click", function () {
	  $(this).find("i").toggleClass("fa-bars fa-times");
	  $(".offcanvas-collapse").toggleClass("open");
	});
  
	// Hover for dropdown in desktop
	function toggleDropdown(e) {
	  const _d = $(e.target).closest(".dropdown"),
		_m = $(".dropdown-menu", _d);
	  setTimeout(function () {
		const shouldOpen = e.type !== "click" && _d.is(":hover");
		_m.toggleClass("show", shouldOpen);
		_d.toggleClass("show", shouldOpen);
		$('[data-toggle="dropdown"]', _d).attr("aria-expanded", shouldOpen);
	  }, e.type === "mouseleave" ? 300 : 0);
	}
  
	$("body")
	  .on("mouseenter mouseleave", ".dropdown", toggleDropdown)
	  .on("click", ".dropdown-menu a", toggleDropdown);
  
	// Remove long focus on buttons
	$(".button, a, button").mouseup(function () {
	  $(this).blur();
	});
  
	// Smooth scroll helper for nav links (no # at end)
	function getMenuItems() {
	  var menuItems = [];
	  $(".nav-link").each(function () {
		var hash = $(this).attr("href").substr(1);
		if (hash !== "") menuItems.push(hash);
	  });
	  return menuItems;
	}
  
	$(".nav-link").click(function (e) {
	  var hash = $(this).attr("href").substr(1);
	  if (hash === "") e.preventDefault();
	});
  })(jQuery);
  