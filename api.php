<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$file = 'scores.json';

/**
 * Reads scores from file, creating it with default values if it doesn't exist.
 */
function getScores($file) {
    if (!file_exists($file)) {
        $initial = ["player_x" => 0, "player_o" => 0, "draws" => 0];
        file_put_contents($file, json_encode($initial, JSON_PRETTY_PRINT));
        return $initial;
    }
    $content = file_get_contents($file);
    $data = json_decode($content, true);
    if (!$data) {
        return ["player_x" => 0, "player_o" => 0, "draws" => 0];
    }
    return $data;
}

$action = isset($_GET['action']) ? $_GET['action'] : '';

if ($action === 'get_scores') {
    echo json_encode(getScores($file));
    exit;
} elseif ($action === 'update_scores' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $winner = isset($input['winner']) ? $input['winner'] : '';
    
    $scores = getScores($file);
    
    if ($winner === 'X') {
        $scores['player_x']++;
    } elseif ($winner === 'O') {
        $scores['player_o']++;
    } elseif ($winner === 'draw') {
        $scores['draws']++;
    } elseif ($winner === 'reset') {
        $scores = ["player_x" => 0, "player_o" => 0, "draws" => 0];
    }
    
    file_put_contents($file, json_encode($scores, JSON_PRETTY_PRINT));
    echo json_encode($scores);
    exit;
} else {
    http_response_code(400);
    echo json_encode(["error" => "Invalid action or request method"]);
    exit;
}
