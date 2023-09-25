<?php

/**
 * @file
 * Contains \Drupal\links_example\Controller\LinksExampleController
 */

namespace Drupal\links_example\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\Response;
use Drupal\Core\Link;
use Drupal\Core\Url;

class LinksExampleController extends ControllerBase {

    public function links() {
        // link to /admin/structure/blocks
        $url1 = Url::fromRoute('block.admin_display');
        $link1 = Link::fromTextAndUrl(t('Go to block admin page'), $url1);
        $list[] = $link1;

         // link to /admin/content
    $url2 = Url::fromRoute('system.admin_content');
    $link2 = Link::fromTextAndUrl(t('Go to content admin page'), $url2);
    $list[] = $link2;

     // link to /admin/people
     $url3 = Url::fromRoute('entity.user.collection');
     $link3 = Link::fromTextAndUrl(t('Go to user admin page'), $url3);
     $list[] = $link3;

     // link to homepage
     $url4 = Url::fromRoute('<front>');
     $link4 = Link::fromTextAndUrl(t('Go to the front page'), $url4);
     $list[] = $link4;

     // External link to drupal.org
    $url5 = Url::fromUri('https://drupal.org');
    $link_options = [
      'attributes'=> [
        'target'=>'_blank',
        'title'=> 'Link to Drupal home page',
      ],
    ];
    $url5->setOptions($link_options);
    $link5 = Link::fromTextAndUrl(t('Go to Drupal.org site'), $url5);
    $list[] = $link5;

    // Mount the render output
    $output['links_example']= [
      '#theme'=> 'item_list',
      '#items'=> $list,
      '#title'=>$this->t('Example of links:'),
    ];
    return $output;

    }
}