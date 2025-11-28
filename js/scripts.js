/* Template: Reshape
   Description: Custom JS file for the Reshape App
*/

(function ($) {
	"use strict";

	// On Scroll Function
	$(window).on('scroll load', function () {
		const $logoImage = $('#logo-image');
		const $logoBlog = $('#logo-image-blog');
		const navbarTop = $(".navbar").offset().top;

		if (navbarTop > 60) {
			if (!$(".fixed-top").hasClass("top-nav-collapse")) {
				$(".fixed-top").addClass("top-nav-collapse");
				$(".nav-link").removeClass("text-white");
				$logoImage.attr('src', 'assets/reshape_color.webp'); // Change the image source
				$logoBlog.attr('src', '../assets/reshape_color.webp'); // Change the image source

			}
		} else {
			if ($(".fixed-top").hasClass("top-nav-collapse")) {
				$(".fixed-top").removeClass("top-nav-collapse");
				$(".nav-link").addClass("text-white");
				$logoImage.attr('src', 'assets/reshape_white.webp'); // Change the image source
				$logoBlog.attr('src', '../assets/reshape_white.webp'); // Change the image source

			}
		}
	});


	document.addEventListener('DOMContentLoaded', () => {
		// ================================
		// Video + Blurhash placeholder setup
		// ================================
		function setupVideoWithPlaceholder(videoId, placeholderId) {
			const $video = $('#' + videoId);
			const $placeholder = $('#' + placeholderId);
		  
			if (!$video.length) return;
		  
			const videoEl = $video.get(0);
			if (!videoEl) return;
		  
			function showVideo() {
			  // Try to start playback
			  videoEl.play().catch(() => {
				// If autoplay is blocked, at least fade the first frame in
				console.warn('Autoplay blocked, showing video frame only');
			  });
		  
			  $video.css('opacity', '1');
		  
			  if ($placeholder.length) {
				$placeholder.fadeOut(700, function () {
				  $(this).hide();
				});
			  }
			}
		  
			if (videoEl.readyState >= 2) {
			  showVideo();
			} else {
			  videoEl.addEventListener('loadeddata', showVideo);
			  videoEl.addEventListener('canplay', showVideo);
			}
		  }
		  

		// Home hero video
		setupVideoWithPlaceholder('home-video', 'blurhash-placeholder-home');

		// Other section videos (only run where they exist)
		setupVideoWithPlaceholder('experience-video', 'blurhash-placeholder-experience');
		setupVideoWithPlaceholder('nutrition-video', 'blurhash-placeholder-nutrition');
		setupVideoWithPlaceholder('evolt-video', 'blurhash-placeholder-evolt');
		setupVideoWithPlaceholder('training-video', 'blurhash-placeholder-training');
		setupVideoWithPlaceholder('beat-video', 'blurhash-placeholder-beat');
		setupVideoWithPlaceholder('predators-video', 'blurhash-placeholder-predators');
		setupVideoWithPlaceholder('hybrid-video', 'blurhash-placeholder-hybrid');
		setupVideoWithPlaceholder('reshape-video', 'blurhash-placeholder-reshape');
		setupVideoWithPlaceholder('elite-video', 'blurhash-placeholder-elite');

		// ================================
		// Scroll animations
		// ================================
		const observer = new IntersectionObserver(entries => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					entry.target.classList.add('show');
					observer.unobserve(entry.target);
				}
			});
		}, {
			threshold: 0.1
		});

		document.querySelectorAll('.fade-in').forEach(element => {
			observer.observe(element);
		});

		//Adding Repuso API Code Here
		var script = document.createElement("script");
		script.type = "module";
		script.src = "https://repuso.com/widgets/2.0/rw-widget-masonry.js";
		document.getElementsByTagName("head")[0].appendChild(script);

		//Share the Page functionalities
		const viewBtn = document.querySelector(".btn-calendar1"),
			popup = document.querySelector(".popup"),
			close = popup.querySelector(".close"),
			field = popup.querySelector(".field"),
			input = field.querySelector("input"),
			copy = field.querySelector("button");

		viewBtn.onclick = (e) => {
			e.preventDefault();
			popup.classList.toggle("show");
		};
		close.onclick = () => {
			viewBtn.click();
		};

		copy.onclick = () => {
			input.select(); //select input value
			if (document.execCommand("copy")) { //if the selected text is copied
				field.classList.add("active");
				copy.innerText = "Copied";
				setTimeout(() => {
					window.getSelection().removeAllRanges(); //remove selection from page
					field.classList.remove("active");
					copy.innerText = "Copy";
				}, 3000);
			}
		};

		document.querySelector('.backdrop').addEventListener("click", function (e) {
			popup.classList.remove("show");
		});

		$('.accordion__header').on('click', function () {
			var accordion = $(this).parent();
			accordion.toggleClass('open');
			var icon = $(this).find('.fa');
			if (icon.hasClass('fa-plus')) {
				icon.removeClass('fa-plus').addClass('fa-minus');
			} else {
				icon.removeClass('fa-minus').addClass('fa-plus');
			}
			var content = accordion.find('.accordion__content');
			if (accordion.hasClass('open')) {
				content.css('height', content.prop('scrollHeight') + 'px');
			} else {
				content.css('height', '0');
			}
		});

		//Adding cookies Setting
		$('body').append(`
<div id="cookie-banner" class="cookie-banner">
    <p>We use cookies to ensure you get the best experience on our website. <a href="/privacy.html">Learn more about our privacy policy</a>.</p>
    <button id="accept-cookies" class="cookie-button rounded-full">OK</button>
</div>
`);

		var $banner = $('#cookie-banner');
		var $acceptButton = $('#accept-cookies');

		// Check if the user has already accepted cookies
		if (!localStorage.getItem('cookiesAccepted')) {
			$banner.show();
		}

		$acceptButton.on('click', function () {
			localStorage.setItem('cookiesAccepted', 'true');
			$banner.hide();
		});

	});

	// Adding FAq Section (pure JS)
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


	// Menu Toggle for small Devices
	$('[data-toggle="offcanvas"], .nav-link:not(.dropdown-toggle)').on('click', function () {
		console.log("Hello!");
		$(this).find('i').toggleClass('fa-bars fa-times');
		$('.offcanvas-collapse').toggleClass('open');
	});

	// hover in desktop mode
	function toggleDropdown(e) {
		const _d = $(e.target).closest('.dropdown'),
			_m = $('.dropdown-menu', _d);
		setTimeout(function () {
			const shouldOpen = e.type !== 'click' && _d.is(':hover');
			_m.toggleClass('show', shouldOpen);
			_d.toggleClass('show', shouldOpen);
			$('[data-toggle="dropdown"]', _d).attr('aria-expanded', shouldOpen);
		}, e.type === 'mouseleave' ? 300 : 0);
	}
	$('body')
		.on('mouseenter mouseleave', '.dropdown', toggleDropdown)
		.on('click', '.dropdown-menu a', toggleDropdown);

	/* Removes Long Focus On Buttons */
	$(".button, a, button").mouseup(function () {
		$(this).blur();
	});

	/* Function to get the navigation links for smooth page scroll */
	function getMenuItems() {
		var menuItems = [];
		$('.nav-link').each(function () {
			var hash = $(this).attr('href').substr(1);
			if (hash !== "")
				menuItems.push(hash);
		});
		return menuItems;
	}

	/* Prevents adding of # at the end of URL on click of non-pagescroll links */
	$('.nav-link').click(function (e) {
		var hash = $(this).attr('href').substr(1);
		if (hash == "")
			e.preventDefault();
	});

	$(".scroll-to-booking").click(function () {
		$("html, body").animate({
			scrollTop: $("#booking-section").offset().top
		}, 800); // 800ms smooth scroll
	});

})(jQuery);
