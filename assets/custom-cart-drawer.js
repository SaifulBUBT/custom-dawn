// You need to insert this script somewhere in the theme, for example in the theme.liquid file
// <script src="{{ 'custom-cart-drawer.js' | asset_url }}" defer></script>

class CustomCartDrawer extends HTMLElement {
  constructor() {
    super();
    this.cartRerenderHandler = this.cartRerender.bind(this);
  }

  connectedCallback() {
    this.openTrigger = document.querySelector(`#${this.dataset.openTrigger}`);
    console.log("Open trigger",this.openTrigger);
    this.overlay = this.querySelector("#CustomCartOverlay");
    this.closeButton = this.querySelector('[data-close]');

    this.openTrigger?.addEventListener("click", this.handleOpen.bind(this));
    this.closeButton?.addEventListener("click", this.closeDrawer.bind(this));
    document.addEventListener("click", (event) => {
      if (event.target === this.overlay) {
        this.closeDrawer();
      }
    });

    document.addEventListener("cart:rerender", this.cartRerenderHandler);
  }
 
  disconnectedCallback() {
    document.removeEventListener("cart:rerender", this.cartRerenderHandler);
  }

  handleOpen(event) {
    event.preventDefault();
    this.openDrawer();
  }

  openDrawer() {
    this.setAttribute("open", "");
  }

  closeDrawer() {
    this.removeAttribute("open");
  }

  cartRerender(event) {
    // We first create empty fake elements so we can store the HTML string of the new section later on
    // This helps with selecting the right elements to replace without reloading the page

    const fakeElement = document.createElement("div");
    const fakeCount = document.createElement("div");
    const newHTML = event.detail?.sections?.["custom-cart-drawer"];
    const newCount = event.detail?.sections?.["cart-icon-bubble"];
    const itemCount = Number(event.detail?.item_count ?? 0);

    if (newHTML) {
      fakeElement.innerHTML = newHTML;
      const drawerInner = fakeElement.querySelector(".custom-cart-drawer__inner");

      if (drawerInner) {
        this.querySelector(".custom-cart-drawer__inner").innerHTML = drawerInner.innerHTML;
      }
    }

    if (newCount) {
      fakeCount.innerHTML = newCount;

      // The Section Rendering API wraps the section in
      // #shopify-section-cart-icon-bubble. Grab that wrapper's inner content
      // (icon + count bubble) and replace the whole cart link markup so the
      // icon, bubble presence, and count all stay in sync — including when the
      // cart goes from empty to non-empty (and back), where the bubble element
      // may not exist yet in the DOM.
      const renderedIcon = fakeCount.querySelector(".shopify-section") ?? fakeCount;
      const cartIconBubble = document.getElementById("cart-icon-bubble");

      if (cartIconBubble) {
        cartIconBubble.innerHTML = renderedIcon.innerHTML;
      }
    } else {
      // Fallback when the section wasn't returned: patch any existing bubble.
      document.querySelectorAll(".cart-count-bubble").forEach((bubble) => {
        bubble.textContent = itemCount > 0 ? itemCount : "";
      });
    }

    this.openDrawer();
  }
}

customElements.define("custom-cart-drawer", CustomCartDrawer);

class AtcButton extends HTMLElement {
  constructor() {
    super();
    this.handleSubmitBound = this.handleSubmit.bind(this);
  }

  connectedCallback() {
    this.submitForm = this.querySelector('form[action="/cart/add"]');

    if (this.submitForm) {
      this.submitForm.addEventListener("submit", this.handleSubmitBound);
    }
  }

  disconnectedCallback() {
    if (this.submitForm) {
      this.submitForm.removeEventListener("submit", this.handleSubmitBound);
    }
  }

  handleSubmit(event) {
    event.preventDefault();

    const variantInput = this.submitForm.querySelector('input[name="id"]');
    const quantityInput = this.submitForm.querySelector('input[name="quantity"]');

    if (!variantInput) {
      return;
    }

    const formData = {
      items: [
        {
          id: variantInput.value,
          quantity: quantityInput?.value || 1,
        },
      ],
      sections: "custom-cart-drawer,cart-icon-bubble",
    };

    fetch(window.Shopify.routes.root + "cart/add.js", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    })
      .then((response) => {
        return response.json();
      })
      .then((data) => {
        document.dispatchEvent(
          new CustomEvent("cart:rerender", {
            detail: data,
          })
        );

        const drawer = document.querySelector("custom-cart-drawer");
        drawer?.openDrawer();
      })
      .catch((error) => {
        console.error("Error:", error);
      });

  }

}

customElements.define("atc-button", AtcButton);

class CartActions extends HTMLElement {
  constructor() {
    super();
    this.handleChangeBound = this.handleChange.bind(this);
  }

  connectedCallback() {
    this.plusButton = this.querySelector("[data-plus]");
    this.minusButton = this.querySelector("[data-minus]");
    this.removeButton = this.querySelector("[data-remove]");

    this.plusButton?.addEventListener("click", this.handleChangeBound);
    this.minusButton?.addEventListener("click", this.handleChangeBound);
    this.removeButton?.addEventListener("click", this.handleChangeBound);
  }

  disconnectedCallback() {
    this.plusButton?.removeEventListener("click", this.handleChangeBound);
    this.minusButton?.removeEventListener("click", this.handleChangeBound);
    this.removeButton?.removeEventListener("click", this.handleChangeBound);
  }

  handleChange(event) {
    const formData = {
      line: this.dataset.line,
      quantity: event.target.dataset.quantity,
      sections: "custom-cart-drawer,cart-icon-bubble",
    };

    fetch(window.Shopify.routes.root + "cart/change.js", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    })
      .then((response) => {
        return response.json();
      })
      .then((data) => {
        console.log(data);
        document.dispatchEvent(
          new CustomEvent("cart:rerender", {
            detail: data,
          })
        );
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }
}

customElements.define("cart-actions", CartActions);

class DiscountInput extends HTMLElement {
  constructor() {
    super();
    this.handleSubmitBound = this.handleSubmit.bind(this);
  }

  connectedCallback() {
    this.submitForm = this.querySelector('#discount-form');
    this.removeButtons = this.querySelectorAll('.cart-discount__pill-remove');

    if (this.submitForm) {
      this.submitForm.addEventListener('submit', this.handleSubmitBound);
    }

    this.removeButtons.forEach((button) => {
      button.addEventListener('click', (event) => this.handleRemove(event, button))
    })
  }

  disconnectedCallback() {
    if (this.submitForm) {
      this.submitForm.removeEventListener('submit', this.handleSubmitBound);
    }
  }

  handleSubmit(event) {
    event.preventDefault();

    const formData = {
      discount: this.submitForm.querySelector('input[name="discount"]').value,
      sections: "custom-cart-drawer,cart-icon-bubble",
    };

    fetch(window.Shopify.routes.root + "cart/update.js", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    })
      .then((response) => {
        return response.json();
      })
      .then((data) => {
        console.log(data);
        document.dispatchEvent(
          new CustomEvent("cart:rerender", {
            detail: data,
          })
        );
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }

  handleRemove(event, button) {
    event.preventDefault();

    const formData = {
      discount: '',
      sections: "custom-cart-drawer,cart-icon-bubble",
    };

    fetch(window.Shopify.routes.root + "cart/update.js", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    })
      .then((response) => {
        return response.json();
      })
      .then((data) => {
        console.log(data);
        document.dispatchEvent(
          new CustomEvent("cart:rerender", {
            detail: data,
          })
        );
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }
}

customElements.define("discount-input", DiscountInput);
