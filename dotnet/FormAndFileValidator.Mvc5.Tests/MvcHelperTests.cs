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

        [FileRules(Extensions = "png,jpg", MaxSizeMB = 1, Required = true)]
        public System.Web.HttpPostedFileBase Avatar { get; set; }
    }

    /// <summary>A real HttpPostedFileBase (the abstract class MVC 5 hands to actions).</summary>
    public class PostedFile : System.Web.HttpPostedFileBase
    {
        readonly byte[] _data; readonly string _name, _type;
        public PostedFile(string name, string type, byte[] data) { _name = name; _type = type; _data = data; }
        public override string FileName { get { return _name; } }
        public override string ContentType { get { return _type; } }
        public override int ContentLength { get { return _data.Length; } }
        public override System.IO.Stream InputStream { get { return new System.IO.MemoryStream(_data, false); } }
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
        public void FileRulesJson_gives_the_browser_config_of_the_file_rules()
        {
            Assert.Equal("{\"Avatar\":{\"allowedExtensions\":[\"png\",\"jpg\"],\"maxFileSizeMB\":1}}", Helper(new SignupModel()).FileRulesJson().ToString());
        }

        [Fact]
        public void A_real_HttpPostedFileBase_is_validated_by_the_FileRules_attribute_and_FileValidator()
        {
            byte[] exe = new byte[128]; exe[0] = (byte)'M'; exe[1] = (byte)'Z'; exe[60] = 0x80;
            var results = new System.Collections.Generic.List<ValidationResult>();
            var model = new SignupModel { Avatar = new PostedFile("me.png", "image/png", exe) };
            Validator.TryValidateObject(model, new ValidationContext(model), results, true);
            Assert.Contains(results, r => r.MemberNames.Contains("Avatar") && r.ErrorMessage.Contains("This file contains exe"));

            var ok = FileValidator.ValidateRaw(new PostedFile("notes.txt", "text/plain", System.Text.Encoding.UTF8.GetBytes("hello")));
            Assert.True(ok.IsValid);
            var many = FileValidator.ValidateRaw(new[] { new PostedFile("a.txt", "text/plain", new byte[] { 65 }), new PostedFile("b.exe", "", new byte[] { 65 }) });
            Assert.Equal(new[] { "DANGEROUS_FILE_TYPE" }, many.Errors);
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
