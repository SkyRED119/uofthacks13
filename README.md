## Inspiration
[This video by Buffed](https://www.youtube.com/watch?v=NdKcDPBQ-Lw) was definitely a considerable inspiration for this idea. 

## What it does
Users can upload txt, md, or pdf files that they wish to read, and the website will use a technique known as rapid serial visual presentation (or RSVP) to quickly flash through the words on screen. Many QoL features are available. Users can set and change the speed (in WPM) of the words being displayed on screen, pause or resume reading if they get lost, and look through the words by either clicking on a preview/postview screen that lets you jump around to specific words, or by searching for specific words (or substrings) and skipping ahead to the next instance of the desired word. Additionally, each word is anchored down by a highlighted letter which allows users to more easily concentrate on the words on-screen, and the RSVP automatically pauses when the user blinks to avoid loss of information. 

## How I built it
I used the front-end trifecta of HTML, CSS, and JavaScript for the main web application and all rendering logic, with Python for PDF parsing and insights, Flask for front-end/back-end communication, openCV and mediapipe for AI blinking recognition, and ElevenLabs for Text-to-Speech. 

## Challenges I ran into
It took a while to figure out how to get the highlighted letter to stay in one spot and perform the duty of being an easy-to-focus-on location. It took even longer to get the blinking detection to work correctly and communicate with the rest of the back-end and transfer that information to the front-end when needed. Issues with the latter stemmed from dependencies not being installed correctly or not being installable at all in some cases. 

## Accomplishments that I am proud of
As a first time hacker, I am actually quite proud of simply being able to create a functioning app as I had envisioned it in my head. No doubt it was also more difficult due to me flying solo. I am also very happy with my solution for dealing with the highlighted letter; specifically, the idea of partitioning the word into three parts to be dealt with individually, since this allowed for a very consistent setup and execution. 

## What I learned
Finding a team early is really important!! On a serious note, though, this was my first time creating a full-stack project, so learning how to use Flask and requests such as GET, POST, etc. was invaluable experience for me. Also, this was my first time doing anything with machine learning APIs like openCV or mediapipe, and for all the headaches they had, like figuring out how mediapipe needs very specific Python versions to actually work properly, or the limitations of the Haar-cascade, I still think that it was worth experimenting with these tools and learning how they work in order to achieve my project's goals. 

## What's next for Ultra Hyper QoL RSVP
Getting the TTS to work natively, configuring multiple languages, and setting up an actual server for this website to be usable from beyond my own machine. 
