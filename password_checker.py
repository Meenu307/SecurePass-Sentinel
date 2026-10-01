import string


# ==========================================
# CHECK UPPERCASE
# ==========================================

def check_upper(text):

    for character in text:

        if character.isupper():
            return True

    return False


# ==========================================

# CHECK LOWERCASE
# ==========================================

def check_lower(text):

    for character in text:

        if character.islower():
            return True

    return False


# ==========================================
# CHECK DIGIT
# ==========================================

def check_digit(text):

    for character in text:

        if character.isdigit():
            return True

    return False


# ==========================================
# CHECK SPECIAL CHARACTER
# ==========================================

def check_special(text):

    for character in text:

        if character in string.punctuation:
            return True

    return False


# ==========================================
# CHECK LENGTH
# ==========================================

def check_length(text):

    return len(text) >= 8


# ==========================================
# CHECK STRENGTH
# ==========================================

def check_strength(points):

    if points <= 2:
        return "WEAK"

    elif points <= 4:
        return "MEDIUM"

    else:
        return "STRONG"


# ==========================================
# MAIN PASSWORD CHECKER
# ==========================================

def check_password():

    # Empty password check
    while True:

        password = input("\nEnter your password: ")

        if password == "":
            print("\nPassword can't be empty!")
            print("Please enter a valid password.")

        else:
            break


    # Check password
    has_upper = check_upper(password)
    has_lower = check_lower(password)
    has_digit = check_digit(password)
    has_special = check_special(password)
    has_length = check_length(password)


    # Calculate score
    score = 0

    suggestions = []


    # Uppercase
    if has_upper:
        score += 1

    else:
        suggestions.append("Add an uppercase letter")


    # Lowercase
    if has_lower:
        score += 1

    else:
        suggestions.append("Add a lowercase letter")


    # Number
    if has_digit:
        score += 1

    else:
        suggestions.append("Add a number")


    # Special character
    if has_special:
        score += 1

    else:
        suggestions.append("Add a special character")


    # Length
    if has_length:
        score += 1

    else:
        suggestions.append("Use at least 8 characters")


    # Determine strength
    strength = check_strength(score)


    # Display result
    print("\n==============================")
    print("       PASSWORD ANALYSIS")
    print("==============================")

    print("\nUppercase:", "✓" if has_upper else "✗")
    print("Lowercase:", "✓" if has_lower else "✗")
    print("Number:", "✓" if has_digit else "✗")
    print("Special character:", "✓" if has_special else "✗")
    print("Length:", "✓" if has_length else "✗")

    print("\nScore:", score)
    print("Password Strength:", strength)


    # Display suggestions
    if suggestions:

        print("\nHow to improve:")

        for suggestion in suggestions:
            print("≫", suggestion)

    else:

        print("\nExcellent! Your password meets all the requirements.")


if __name__ == "__main__":
    check_password()


