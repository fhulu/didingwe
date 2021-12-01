# didingwe Web Page Framework

Suppose you wanted to create a simple Sign Up page for your website. 


The front end code would look like this.

```
<form action="signup.php">
  <p>Sign up</p>
  <div class=input>
    <label>Name:</label>
    <input type="text" name="user_name" required>
  </div>
  <div class=input>
    <label>Email:</label>
    <input type ="email" name="email" required>
  </div>
  <div class=input>
    <label>Password:</label>
    <input type ="password" name="password" >
  </div>
  <input type="submit" value="Sign Up"/>
</form>
```

Using Didingwe framework, the alternative code is:

```
sign_up:
  access: public
  type: input_page
  inputs:
    - user_name
    - email
    - password
  actions:
    - sign_up
  post:
    - db.insert: [user, $request]
	audit: $user_name $email
```

