using System.Linq;
using System.ComponentModel.DataAnnotations;
using System.Web.Mvc;
using FormAndFileValidator.Mvc;
using Xunit;

namespace FormAndFileValidator.Mvc5.Tests
{
    public class SignupModel
    {
        [FormRules("[\"required\", \"email\"]")]
        public string Email { get; set; }

        [FormRules("[\"required\", {\"type\":\"date\",\"format\":\"d/M/y\"}]")]
        public string BirthDate { get; set; }
    }

    /// <summary>The Razor helpers and ModelState, on a real HtmlHelper of ASP.NET MVC 5.</summary>
    public class MvcHelperTests
    {
        static HtmlHelper<SignupModel> Helper(SignupModel model)
        {
            var viewContext = new ViewContext();
            var container = new ViewPage { ViewData = new ViewDataDictionary<SignupModel>(model) };
            return new HtmlHelper<SignupModel>(viewContext, container);
        }

        [Fact]
        public void FormValidatorInit_writes_a_script_with_the_model_rules()
        {
            string html = Helper(new SignupModel()).FormValidatorInit("signup").ToString();
            Assert.StartsWith("<script>FormValidator.init({ formId: \"signup\", rules: {", html);
            Assert.EndsWith("});</script>", html);
            Assert.Contains("\"Email\":[\"required\", \"email\"]", html);
            Assert.Contains("\"format\":\"d/M/y\"", html);
        }

        [Fact]
        public void FormRulesJson_is_the_rules_object()
        {
            string json = Helper(new SignupModel()).FormRulesJson().ToString();
            Assert.StartsWith("{\"Email\":", json);
            Assert.Contains("\"BirthDate\":", json);
        }

        [Fact]
        public void Model_binding_validation_fills_ModelState_like_any_DataAnnotation()
        {
            var model = new SignupModel { Email = "a@b", BirthDate = "31/4/2024" };
            var controllerContext = new ControllerContext();
            var bindingContext = new ModelBindingContext
            {
                ModelMetadata = ModelMetadataProviders.Current.GetMetadataForType(() => model, typeof(SignupModel)),
                ModelState = new ModelStateDictionary(),
                ValueProvider = new NameValueCollectionValueProvider(new System.Collections.Specialized.NameValueCollection(), System.Globalization.CultureInfo.InvariantCulture)
            };
            foreach (var property in bindingContext.ModelMetadata.Properties)
                foreach (var v in ModelValidatorProviders.Providers.GetValidators(property, controllerContext).SelectMany(x => x.Validate(model)))
                    bindingContext.ModelState.AddModelError(property.PropertyName, v.Message);

            Assert.False(bindingContext.ModelState.IsValid);
            Assert.Equal("Please enter a valid email address.", bindingContext.ModelState["Email"].Errors[0].ErrorMessage);
            Assert.Equal("Please enter a valid date.", bindingContext.ModelState["BirthDate"].Errors[0].ErrorMessage);
        }
    }
}
