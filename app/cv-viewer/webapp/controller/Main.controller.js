sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast"
], function (Controller, MessageToast) {
    "use strict";

    return Controller.extend("cv.viewer.controller.Main", {

        onInit: function () {
            console.log("View ready, model:", this.getView().getModel("cv").getProperty("/profile/firstName"));
        },

        onLinkedIn: function () {
            var sUrl = this.getView().getModel("cv").getProperty("/profile/linkedinUrl");
            if (sUrl) { window.open(sUrl, "_blank"); }
            else { MessageToast.show("LinkedIn no configurado"); }
        },

        onGitHub: function () {
            var sUrl = this.getView().getModel("cv").getProperty("/profile/githubUrl");
            if (sUrl) { window.open(sUrl, "_blank"); }
            else { MessageToast.show("GitHub no configurado"); }
        }
    });
});