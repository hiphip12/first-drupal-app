<?php

namespace Drupal\first_module\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\Response;

class MyButtonController extends ControllerBase {

    public function content () {
        // return new Response("Hello from my first drupal 10 module");
        // return $this->render('secondpage.html.twig');

        //Create a buttton element with an id and an onclick attribute
        $button = [
            '#type' => 'html_tag',
            '#tag' => 'button',
            '#value' => $this->t('Click this button'),
            '#attributes'=> [
                'id'=> 'mybutton',
                'onclick'=> $this->saysWelcome(),
            ],
        ];
        return $button;

        // Create a script element that defines saysWelcome function
    }

    public function saysWelcome() {
        return "alert('Button clicked...')";
    }
}
