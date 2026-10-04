using System.Web.Mvc;
using FormAndFileValidator.Mvc;
using Mvc5Demo.Models;

namespace Mvc5Demo.Controllers
{
    public class AccountController : Controller
    {
        // ------------------------------------------------------------ direct submit: the browser posts the form, the page comes back
        [HttpGet]
        public ActionResult Signup()
        {
            return View(new SignupModel());
        }

        [HttpPost]
        public ActionResult Signup(SignupModel model)
        {
            // the [FormRules] attributes already ran: nothing else to write
            if (!ModelState.IsValid) return View(model);
            return View("Done", model);
        }

        // ------------------------------------------------------------ AJAX: the page sends the validated values as JSON, the server answers with JSON
        [HttpGet]
        public ActionResult SignupAjax()
        {
            return View(new SignupModel());
        }

        [HttpPost]
        public ActionResult SignupAjax(SignupModel model)
        {
            // 1. the same rules as in the browser (ModelState), 2. then a rule only the server can know
            if (ModelState.IsValid && model.Email != null && model.Email.Trim().ToLowerInvariant() == "taken@example.com")
                ModelState.AddModelError("Email", "Already registered");

            if (!ModelState.IsValid)
            {
                Response.StatusCode = 422;
                return Json(new { errors = ModelState.ToErrorMap() });   // { errors: { Email: "..." } }: the browser shows them on the fields
            }
            return Json(new { ok = true, name = model.FirstName });
        }
    }
}
