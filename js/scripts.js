/* Template: Reshape
   Description: Custom JS file for the Reshape App
*/

(function ($) {
	"use strict";

	// On Scroll Function
	$(window).on('scroll load', function () {
		const $logoImage = $('#logo-image');
		const navbarTop = $(".navbar").offset().top;

		if (navbarTop > 60) {
			if (!$(".fixed-top").hasClass("top-nav-collapse")) {
				$(".fixed-top").addClass("top-nav-collapse");
				$(".nav-link").removeClass("text-white");
				$logoImage.attr('src', 'assets/reshape_color.webp'); // Change the image source
			}
		} else {
			if ($(".fixed-top").hasClass("top-nav-collapse")) {
				$(".fixed-top").removeClass("top-nav-collapse");
				$(".nav-link").addClass("text-white");
				$logoImage.attr('src', 'assets/reshape_white.webp'); // Change the image source
			}
		}
	});


	document.addEventListener('DOMContentLoaded', () => {
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


		// Adding Animation on Scroll
		document.querySelectorAll('.fade-in').forEach(element => {
			observer.observe(element);
		});

		// Open the Chatbot when Clicked
		window.addEventListener('mouseover', initLandbot, { once: true });
		window.addEventListener('touchstart', initLandbot, { once: true });

		var myLandbot;

		function initLandbot() {
			if (!myLandbot) {
				var s = document.createElement('script'); s.type = 'text/javascript'; s.async = true;
				s.addEventListener('load', function () {
					myLandbot = new Landbot.Popup({
						configUrl: 'https://storage.googleapis.com/landbot.pro/v3/H-2143862-SFZLSX1Y17KLVYW9/index.json',
					});

					var buttonsOpen = document.querySelectorAll(".open-bot");
					buttonsOpen.forEach(function (button) {
						button.addEventListener('click', function (event) {
							event.preventDefault();
							myLandbot.open();
						});
					});
				});
				s.src = 'https://cdn.landbot.io/landbot-3/landbot-3.0.0.js';
				var x = document.getElementsByTagName('script')[0];
				x.parentNode.insertBefore(s, x);
			}
		}

		//Adding Repuso API Code Here
		var script = document.createElement("script"); script.type = "module"; script.src = "https://repuso.com/widgets/2.0/rw-widget-masonry.js"; document.getElementsByTagName("head")[0].appendChild(script);

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
	}
	close.onclick = () => {
		viewBtn.click();
	}
	
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
	}
	
	document.querySelector('.backdrop').addEventListener("click", function(e) {
		popup.classList.remove("show");
	});

	$('.accordion__header').on('click', function() {
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
<div id="cookie-banner" class="cookie-banner flex items-center justify-between p-4 bg-gray-800 text-white">
    <p class="flex-1">
        We use cookies to ensure you get the best experience on our website. 
        <a href="/privacy.html" class="underline" aria-label="Read our privacy policy to learn more about how we use cookies">
            Read our privacy policy
        </a>.
    </p>
    <button id="close-cookie-banner" class="flex-shrink-0 bg-transparent border-0 p-2 ml-4 align-middle" aria-label="Close cookie banner">
      <i class="fa fa-times" aria-hidden="true"></i>
    </button>
</div>

`);

var $banner = $('#cookie-banner');
var $acceptButton = $('#accept-cookies');

// Check if the user has already accepted cookies
if (!localStorage.getItem('cookiesAccepted')) {
	$banner.show();
}

$acceptButton.on('click', function() {
	localStorage.setItem('cookiesAccepted', 'true');
	$banner.hide();
});
	
	});


	// Adding FAq Section

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


	/* Back To Top Button */
	// create the back to top button
	// $('body').prepend('<a href="#top" class="back-to-top page-scroll">Back to Top</a>');
	// var amountScrolled = 700;
	// $(window).scroll(function () {
	// 	if ($(window).scrollTop() > amountScrolled) {
	// 		$('a.back-to-top').fadeIn('500');
	// 	} else {
	// 		$('a.back-to-top').fadeOut('500');
	// 	}
	// });


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
		})
		return menuItems;
	}

	/* Prevents adding of # at the end of URL on click of non-pagescroll links */
	$('.nav-link').click(function (e) {
		var hash = $(this).attr('href').substr(1);
		if (hash == "")
			e.preventDefault();
	});

	

})(jQuery);

