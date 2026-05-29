import com.google.gson.JsonObject;

// @param to: string
// @param subject: string
// @param body: string
// @returns: object
public class SendEmail {
    public static JsonObject main(JsonObject args) {
        String to = args.getAsJsonPrimitive("to").getAsString();
        String subject = args.getAsJsonPrimitive("subject").getAsString();
        String body = args.getAsJsonPrimitive("body").getAsString();

        JsonObject response = new JsonObject();
        response.addProperty("status", "sent");
        response.addProperty("to", to);
        return response;
    }
}
