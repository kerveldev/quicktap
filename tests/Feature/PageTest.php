<?php

namespace Tests\Feature;

use Tests\TestCase;

class PageTest extends TestCase
{
    public function test_the_spa_shell_and_health_route_need_no_database(): void
    {
        config(['database.default' => 'intentionally-unconfigured']);
        $this->withoutVite()->get('/')->assertOk()->assertSee('id="app"', false)->assertSee('QuickTap');
        $this->get('/up')->assertOk();
    }
}
