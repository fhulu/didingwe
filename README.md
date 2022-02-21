# Didingwe Web Page Framework

An easy to use Single Page Application framework. Keep it simple, I mean really simple. Write less, do more.

## Description

Suppose you wanted to create a simple Sign Up page for your website


The front end code would look something similar to this.

`signup.html`
```html
<form action="signup.php">
  <p>Sign up</p>
  <div class=input>
    <label>First Name:</label>
    <input type="text" name="first_name" required>
  </div>
  <div class=input>
    <label>Last Name:</label>
    <input type="text" name="last_name" required>
  </div>
  <div class=input>
    <label>Email:</label>
    <input type="email" name="email" required>
  </div>
  <input type="submit" value="Sign Up"/>
</form>
```

You will also need to include some CSS to handle styling. CSS Frameworks like Bootstrap, might help style up the page nicely. You may also prefer to do some basic validation using JavaScript. Again Javascript frameworks also come in handy here.


On the back-end, you will need to write code to insert the new records into your user database/table. Good experience with PHP, C#, Java, etc, becomes important here.



Using Didingwe framework, the alternative code is:

`sign_up.yml`
```yaml
sign_up:
  access: public
  type: input_page
  inputs:
    - first_name
    - last_name
    - email
  actions:
    - sign_up
  post:
    - db.insert: [user, first_name, last_name, email]
  audit: $first_name $last_name $email
```

With Didingwe framework the above YAML code is <b>all</b> write to get the page rendered and the user added to the database. No HTML, no JavaScript, no CSS, etc. Just plain easy to read text in YAML.  In fact, it also actually does full work of signing up, even without any custom handwritten backend code. 

The only other work is to configure access to database, for example:

`.site-config.yml`
```yaml
db:	
  database: example
  user: example
  password: example
```

## Getting Started

### Dependencies

* jQuery
* Apache
* PHP
* YAML

#### Optional
* MySQL

Didingwe framework backend is currently implemented using PHP on Apache and nginx. The Node implementation is not up to date but work is currently underway to bring it up to the PHP level. There are also plans to implement the backend in JAVA and C#.

### Installing

### Core
```bash
$ cd /path/to/project
$ git clone https://github.com/fhulu/didingwe.git
```
### Debian + Apache + PHP
```bash
$ ./didingwe/scripts/install-debian-apache-php.sh
```

### Debian + Nngix + PHP
```bash
$ ./didingwe/scripts/install-debian-nginx-php.sh
```

### Debian + NodeJS
* (Not full functional)
```bash
$ ./didingwe/scripts/install-debian-nodejs.sh
```

## Help

Any advise for common problems or issues.
```
command to run if program contains helper info
```

## Authors

Contributors names and contact info

Fhulu Lidzhade
[@FhuluLidzhade1](https://twitter.com/fhululidzhade1)

## Version History

* 0.1
    * Initial Release

## License

This project is licensed under the [NAME HERE] License - see the LICENSE.md file for details

## Acknowledgments

Inspiration, code snippets, etc.
* todo - Documentation
